import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [role, setRole] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    section: '',
    code: ''
  });

  const navigate = useNavigate();

  // State for Students View
  const [showStudentsPopup, setShowStudentsPopup] = useState(false);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [studentsMessage, setStudentsMessage] = useState('');
  // State for Student Removal Confirmation: stores { id, name } of student to remove
  const [confirmRemoval, setConfirmRemoval] = useState(null); 
  // State for Class Deletion Confirmation: stores { id, name } of class to delete
  const [confirmClassDelete, setConfirmClassDelete] = useState(null);
  // State for Class Unenrollment Confirmation: stores { id, name } of class to unenroll from
  const [confirmUnenroll, setConfirmUnenroll] = useState(null); 

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  const dropdownRef = useRef(null);

  // Disabling back button
  useEffect(() => {
    const handlePopState = (e) => {
      // Prevent back navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Adding current state -back has no effect
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!user || !token) {
      navigate('/option');
      return;
    }
    setRole(user.role);
    fetchClassrooms();
    
  }, []);

  const fetchClassrooms = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/classrooms/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassrooms(res.data.classrooms);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/option');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setFormMessage('');
  };

  const handleSubmit = async () => {
    const { name, subject, section, code } = formData;

    if (role === 'teacher') {
      const missingFields = [];
      if (!name.trim()) missingFields.push('class name');
      if (!subject.trim()) missingFields.push('subject name');

      if (missingFields.length > 0) {
        const message =
          missingFields.length === 2
            ? 'Enter the class name and subject name'
            : `Enter ${missingFields[0]}`;
        setFormMessage(message);
        return;
      }
    } else {
      if (!code.trim()) {
        setFormMessage('Enter class code');
        return;
      }
    }

    try {
      if (role === 'teacher') {
        await axios.post(
          'http://localhost:5001/api/classrooms/create',
          { name: name.trim(), subject: subject.trim(), section: section.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setFormMessage('Classroom created successfully!');
      } else {
        await axios.post(
          'http://localhost:5001/api/classrooms/join',
          { code: code.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setFormMessage('Joined classroom successfully!');
      }

      setFormData({ name: '', subject: '', section: '', code: '' });
      fetchClassrooms();

      setTimeout(() => {
        setShowPopup(false);
        setFormMessage('');
      }, 2000);
    } catch (err) {
      setFormMessage(err.response?.data?.msg || 'Operation failed.');
    }
  };

  // --- NEW HANDLER FOR FOLDERS BUTTON ---
  const handleFoldersClick = () => {
    if (classrooms.length > 0) {
      // Get the ID of the first classroom in the list
      const firstClassId = classrooms[0]._id;
      // Navigate to the ClassroomDetail component for that class
      navigate(`/classroom/${firstClassId}`);
      setSidebarOpen(false); // Close sidebar after navigation
    } else {
      // Show message if no classes are available
      setFormMessage("You must join or create a class first to view folders.");
      setTimeout(() => setFormMessage(''), 3000);
    }
  };

  // --- STUDENT MANAGEMENT HANDLERS (Unchanged) ---
  const fetchStudents = async (classId) => {
    setStudentsMessage('Loading members...');
    try {
      const res = await axios.get(`http://localhost:5001/api/classrooms/${classId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudentsList(res.data.members);
      setStudentsMessage('');
    } catch (err) {
      setStudentsMessage(err.response?.data?.msg || 'Failed to fetch members.');
      console.error(err);
      setStudentsList([]);
    }
  };

  const handleViewStudents = (classId) => {
    setCurrentClassId(classId);
    setShowStudentsPopup(true);
    setConfirmRemoval(null); 
    fetchStudents(classId);
  };

  const requestRemoveStudent = (studentId, studentName) => {
    setStudentsMessage(''); 
    setConfirmRemoval({ id: studentId, name: studentName });
  };

  const executeRemoveStudent = async () => {
    if (!confirmRemoval) return;

    const { id: studentId, name: studentName } = confirmRemoval;

    setStudentsMessage(`Removing ${studentName}...`);
    setConfirmRemoval(null); 
    
    try {
      await axios.delete(
        `http://localhost:5001/api/classrooms/${currentClassId}/members/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStudentsMessage(`${studentName} removed successfully!`);
      fetchStudents(currentClassId);

      setTimeout(() => setStudentsMessage(''), 2000);

    } catch (err) {
      setStudentsMessage(err.response?.data?.msg || 'Failed to remove student.');
      console.error(err);
    }
  };

  const cancelRemoveStudent = () => {
    setConfirmRemoval(null);
    setStudentsMessage('');
  };
  // --- END STUDENT MANAGEMENT HANDLERS ---


  // --- TEACHER CLASS DELETION HANDLERS (Unchanged) ---
  const requestDeleteClass = (classId, className) => {
    // Ensure no other modals are open
    setConfirmUnenroll(null);
    setConfirmClassDelete({ id: classId, name: className });
  };

  const executeDeleteClass = async () => {
    if (!confirmClassDelete) return;

    const { id: classId, name: className } = confirmClassDelete;
    setConfirmClassDelete(null); 

    try {
      await axios.delete(
        `http://localhost:5001/api/classrooms/${classId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Optimistically remove the deleted class from the local state
      setClassrooms(prev => prev.filter(cls => cls._id !== classId));
      
      setFormMessage(`Class '${className}' deleted successfully.`); 
      setTimeout(() => setFormMessage(''), 3000);

    } catch (err) {
      console.error('Class deletion failed:', err);
      setFormMessage(err.response?.data?.msg || `Failed to delete class '${className}'.`);
      setTimeout(() => setFormMessage(''), 3000);
    }
  };

  const cancelDeleteClass = () => {
    setConfirmClassDelete(null);
  };
  // --- END TEACHER CLASS DELETION HANDLERS ---
  

  // --- STUDENT UNENROLL HANDLERS (Unchanged) ---
  const requestUnenrollClass = (classId, className) => {
    // Ensure no other modals are open
    setConfirmClassDelete(null);
    setConfirmUnenroll({ id: classId, name: className });
  };

  const executeUnenrollClass = async () => {
    if (!confirmUnenroll) return;

    const { id: classId, name: className } = confirmUnenroll;
    setConfirmUnenroll(null); 

    try {
      // API endpoint to leave a class is typically a DELETE request to /join or a specific endpoint
      await axios.delete(
        `http://localhost:5001/api/classrooms/leave/${classId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Optimistically remove the unenrolled class from the local state
      setClassrooms(prev => prev.filter(cls => cls._id !== classId));
      
      setFormMessage(`You have successfully unenrolled from class '${className}'.`); 
      setTimeout(() => setFormMessage(''), 3000);

    } catch (err) {
      console.error('Unenrollment failed:', err);
      setFormMessage(err.response?.data?.msg || `Failed to unenroll from class '${className}'.`);
      setTimeout(() => setFormMessage(''), 3000);
    }
  };

  const cancelUnenrollClass = () => {
    setConfirmUnenroll(null);
  };
  // --- END STUDENT UNENROLL HANDLERS ---


  const EmptyStateMessage = () => {
    const teacherMessage = "Welcome, Teacher! It looks like you haven't created any classrooms yet. Click the 'Create Class' button below to get started and invite your students!";
    const studentMessage = "Welcome! You haven't joined any classrooms yet. Click the 'Join Class' button below and enter the code provided by your teacher to enroll.";

    return (
      <div className="empty-state-message">
        <p className="large-text">
          {role === 'teacher' ? teacherMessage : studentMessage}
        </p>
      </div>
    );
  };

  return (
    <>
      <header>
        <div className="left-header">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <h1>MetaStudy</h1>
        </div>
        <div className="profile" onClick={() => setDropdownOpen(!dropdownOpen)} ref={dropdownRef}>
          {user?.name?.[0]?.toUpperCase()}
          {dropdownOpen && (
            <div className="dropdown">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard">
        <aside className={sidebarOpen ? 'open' : ''}>
          {/* HOME BUTTON: Navigates back to dashboard, which re-renders this component */}
          <button onClick={() => navigate('/dashboard')}>Home</button>
          
          {/* FOLDERS BUTTON: Navigates to the first class's detail page */}
          <button onClick={handleFoldersClick}>Folders</button> 
          
          <button>Meeting</button>
        </aside>

        <main className={sidebarOpen ? 'shifted' : ''}>
          
          {/* Global Teacher Class Delete Confirmation Modal */}
          {confirmClassDelete && (
            <div className="popup-overlay delete-confirm-overlay">
              <div className="popup-box delete-confirm-box">
                <h3>Confirm Deletion</h3>
                <p>
                  Are you sure you want to permanently delete the class: 
                  {confirmClassDelete.name}?
                </p>
                <p className="warning-text">This action cannot be undone.</p>
                <div className="confirm-actions">
                  <button onClick={executeDeleteClass} className="confirm-delete-btn">Delete Class</button>
                  <button onClick={cancelDeleteClass} className="cancel-btn">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Global Student Unenroll Confirmation Modal */}
          {confirmUnenroll && (
            <div className="popup-overlay unenroll-confirm-overlay">
              <div className="popup-box unenroll-confirm-box">
                <h3>Confirm Unenrollment</h3>
                <p>
                  Are you sure you want to unenroll from the class: 
                  {confirmUnenroll.name}?
                </p>
                <p className="warning-text">You will lose access to all class materials and assignments.</p>
                <div className="confirm-actions">
                  <button onClick={executeUnenrollClass} className="confirm-unenroll-btn">Yes, Unenroll</button>
                  <button onClick={cancelUnenrollClass} className="cancel-btn">Cancel</button>
                </div>
              </div>
            </div>
          )}

            {/* CONDITIONAL RENDERING: Class Grid OR Empty State Message */}
          {classrooms.length > 0 ? (
            <div className="classroom-grid">
              {classrooms.map(cls => (
                <div key={cls._id} className="class-card">
                  
                  {/* Top-Right Action Button */}
                  {role === 'teacher' ? (
                    <button 
                      className="delete-class-btn" 
                      onClick={(e) => { 
                        e.stopPropagation(); // Prevent card navigation
                        requestDeleteClass(cls._id, cls.name);
                      }}
                      disabled={!!confirmClassDelete || !!confirmUnenroll}
                    >
                      Delete
                    </button>
                  ) : (
                    <button 
                      className="unenroll-class-btn" 
                      onClick={(e) => { 
                        e.stopPropagation(); // Prevent card navigation
                        requestUnenrollClass(cls._id, cls.name);
                      }}
                      disabled={!!confirmClassDelete || !!confirmUnenroll}
                    >
                      Unenroll
                    </button>
                  )}

                  <Link to={`/classroom/${cls._id}`} className="class-info">
                    <h2>{cls.name}</h2>
                    <p>{cls.subject} - {cls.section}</p>
                    <span>Code: {cls.code}</span>
                  </Link>
                  <div className="card-action">
                    <button
                      className="meet-btn"
                      onClick={() => handleViewStudents(cls._id)} 
                    >
                      {role === 'teacher' ? 'View Students' : 'View Classmates'} 
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateMessage />
          )}
          {/* END CONDITIONAL RENDERING */}

          <button className="floating-btn" onClick={() => setShowPopup(true)}>
            {role === 'teacher' ? 'Create Class' : 'Join Class'}
          </button>

          {/* Existing Create/Join Class Popup */}
          {showPopup && (
            <div className="popup-overlay">
              <div className="popup-box">
                <span
                  className="close-icon"
                  onClick={() => {
                    setShowPopup(false);
                    setFormData({ name: '', subject: '', section: '', code: '' });
                    setFormMessage('');
                  }}
                >×</span>

                <h3>{role === 'teacher' ? 'Create Classroom' : 'Join Classroom'}</h3>

                {role === 'teacher' ? (
                  <>
                    <input
                      name="name"
                      type="text"
                      placeholder="Class Name"
                      value={formData.name}
                      onChange={handleChange}
                    />
                    <input
                      name="subject"
                      type="text"
                      placeholder="Subject"
                      value={formData.subject}
                      onChange={handleChange}
                    />
                    <input
                      name="section"
                      type="text"
                      placeholder="Section"
                      value={formData.section}
                      onChange={handleChange}
                    />
                  </>
                ) : (
                  <input
                    name="code"
                    type="text"
                    placeholder="Enter Class Code"
                    value={formData.code}
                    onChange={handleChange}
                  />
                )}

                {formMessage && <p className="form-message">{formMessage}</p>}

                <button className="primary" onClick={handleSubmit}>Submit</button>
              </div>
            </div>
          )}
          
          {/* STUDENTS/CLASSMATES POPUP */}
          {showStudentsPopup && (
            <div className="popup-overlay">
              <div className="popup-box students-box">
                <span
                  className="close-icon"
                  onClick={() => {
                    setShowStudentsPopup(false);
                    setStudentsList([]);
                    setStudentsMessage('');
                    setCurrentClassId(null);
                    setConfirmRemoval(null); 
                  }}
                >×</span>

                <h3>{role === 'teacher' ? 'Class Students' : 'Classmates'}</h3>

                {/* INLINE STUDENT REMOVAL CONFIRMATION UI */}
                {confirmRemoval && (
                    <div className="removal-confirm-bar">
                        <p>Are you sure you want to remove {confirmRemoval.name}?</p>
                        <div className="confirm-actions">
                            <button onClick={executeRemoveStudent} className="confirm-yes-btn">Yes, Remove</button>
                            <button onClick={cancelRemoveStudent} className="confirm-no-btn">Cancel</button>
                        </div>
                    </div>
                )}
                {studentsMessage && <p className="form-message">{studentsMessage}</p>}

                <div className="students-list-container">
                    {studentsList.length > 0 ? (
                        <ul>
                            {studentsList.map(member => (
                                <li key={member._id} className="student-item">
                                    <span>{member.name} ({member.role})</span>
                                    {role === 'teacher' && member.role === 'student' && (
                                        <button
                                            className="remove-btn"
                                            onClick={() => requestRemoveStudent(member._id, member.name)}
                                            disabled={confirmRemoval && confirmRemoval.id !== member._id} 
                                        >
                                            Remove
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !studentsMessage && <p>No members found in this class.</p>
                    )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default Dashboard;