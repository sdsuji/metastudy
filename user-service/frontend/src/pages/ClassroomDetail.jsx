import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard/Dashboard.css';
import './ClassroomDetail.css';

const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  // Add state for temporary message, similar to formMessage in Dashboard
  const [mainMessage, setMainMessage] = useState(''); 

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  // Image paths relative to /public
  const folderImages = [
    '/materials.jpeg',
    '/test.png',
    '/assignment.jpeg',
    '/presentation.png',
    '/discussionforum.png',
    '/group.jpeg'
  ];
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
    if (!token) {
      navigate('/option');
      return;
    }

    axios
      .get(`http://localhost:5001/api/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setClassroom(res.data.classroom))
      .catch(() => navigate('/dashboard'));
  }, [id]);

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
  
  // --- NEW HANDLER FOR MEETING BUTTON ---
  const handleMeetingClick = () => {
    setMainMessage("Meeting feature is coming soon!");
    setTimeout(() => setMainMessage(''), 3000);
    setSidebarOpen(false); // Close sidebar after click
  };

  if (!classroom) return <p>Loading...</p>;

  // Folder navigation mapping
  const folderRoutes = {
    "Materials": "materials",
    "Discussion Forum": "discussion",
    "Test Submissions": "tests",
    "Assignment Materials": "assignments", 
    "Presentation Materials": "presentations",
    "Groups": "group-service", 
    // Add more folders 
  };

  return (
    <>
      <header>
        <div className="left-header">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <h1>{classroom.name}</h1>
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
        {/* ASIDE FROM DASHBOARD COMPONENT */}
        <aside className={sidebarOpen ? 'open' : ''}>
          {/* HOME BUTTON: Navigates back to the main dashboard */}
          <button onClick={() => navigate('/dashboard')}>Home</button>
          
          {/* FOLDERS BUTTON: Navigates back to the current class's main detail page (this view) */}
          <button onClick={() => {
            navigate(`/classroom/${id}`); 
            setSidebarOpen(false);
          }}>Folders</button> 
          
          {/* MEETING BUTTON: Placeholder functionality */}
          <button onClick={handleMeetingClick}>Meeting</button>
        </aside>
        {/* END ASIDE */}

        <main className={sidebarOpen ? 'shifted' : ''}>
            {mainMessage && <p className="form-message">{mainMessage}</p>}
          <div className="classroom-grid detail-grid">
            {classroom.folders.map((folder, index) => (
              <div
                key={index}
                className="class-card"
                onClick={() => {
                  const route = folderRoutes[folder.name];
                  if (route) {
                    navigate(`/classroom/${id}/${route}`);
                  }
                }}
                style={{
                  cursor: folderRoutes[folder.name] ? 'pointer' : 'default',
                }}
              >
                <img src={folderImages[index] || '/default-folder.png'} alt={folder.name} className="folder-image" />
                <h3>{folder.name}</h3>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default ClassroomDetail;