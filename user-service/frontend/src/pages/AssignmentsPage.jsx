import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./AssignmentsPage.css";

const AssignmentsPage = () => {
  const { id } = useParams(); // classId
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [showSubmissionPopup, setShowSubmissionPopup] = useState(false);
  const [showAllSubmissionsPopup, setShowAllSubmissionsPopup] = useState(false);
  
  // NEW: State for Editing Assignment
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  // NEW STATE for file replacement
  const [editFile, setEditFile] = useState(null); 

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState(null);

  // Local messages for popups
  const [uploadMsg, setUploadMsg] = useState("");
  const [submissionMsg, setSubmissionMsg] = useState("");
  const [gradingMsg, setGradingMsg] = useState("");

  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submissionTarget, setSubmissionTarget] = useState(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const isTeacher = user?.role === "teacher";
  const navigate = useNavigate();

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
    if (!user || !token) navigate("/option");
    fetchAssignments();
  }, [id, token, user, navigate]); // Added dependencies to useEffect

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- NEW NAVIGATION HANDLERS ---
  const handleHomeClick = () => {
    // Navigates to the main dashboard listing all classes
    navigate("/dashboard");
    setSidebarOpen(false);
  };

  const handleFoldersClick = () => {
    // Navigates to the main page for the current class (using the class ID from useParams)
    navigate(`/classroom/${id}`);
    setSidebarOpen(false);
  };

  const handleMeetingClick = () => {
    // Placeholder for meeting logic, currently just navigates to the class detail page
    // You might replace this with logic to open a meeting link
    console.log(`Meeting button clicked for class ${id}`);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/option");
  };
  // --- END NEW NAVIGATION HANDLERS ---

  const fetchAssignments = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5009/api/assignments/class/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignments(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  const getSignedUrl = async (type, id, action = "view") => {
    try {
      const url =
        type === "assignment"
          ? `http://localhost:5009/api/assignments/${id}/signed-url`
          : `http://localhost:5009/api/submissions/${id}/signed-url`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params: { action },
      });
      return res.data.url;
    } catch (err) {
      console.error("Failed to get signed URL:", err);
      return null;
    }
  };

  const handleView = async (assignmentId) => {
    const url = await getSignedUrl("assignment", assignmentId, "view");
    if (url) window.open(url, "_blank");
  };

  const handleDownload = async (assignmentId) => {
    const url = await getSignedUrl("assignment", assignmentId, "download");
    if (url) window.open(url, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(
        `http://localhost:5009/api/assignments/${deleteTarget._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAssignments();
      setDeleteTarget(null);
      setUploadMsg("Assignment deleted successfully.");
    } catch (err) {
      console.error("Delete failed:", err);
      setUploadMsg("Failed to delete assignment.");
    }
  };
  
  // NEW: Handle assignment edit initiation
  const handleEdit = (assignment) => {
    setEditTarget(assignment);
    setEditTitle(assignment.title);
    setEditDescription(assignment.description || "");
    // Converting backend's ISO date string to YYYY-MM-DD for input type="date"
    const formattedDate = assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : '';
    setEditDueDate(formattedDate);
    setUploadMsg(""); 
    setEditFile(null); // IMPORTANT: Clear previous file selection
    setShowEditPopup(true);
  };
  
  // UPDATED: Handle assignment update submission (now handles file via FormData)
  const handleUpdateAssignment = async () => {
    if (!editTarget || !editTitle || !editDueDate) {
        setUploadMsg("Title and due date are required.");
        return;
    }
    try {
        setUploading(true);
        
        // Use FormData for potential file upload
        const updateData = new FormData();
        updateData.append("title", editTitle);
        updateData.append("description", editDescription);
        updateData.append("dueDate", editDueDate);
        
        // Append file only if one is selected
        if (editFile) {
            updateData.append("file", editFile);
        }

        await axios.patch(
            `http://localhost:5009/api/assignments/${editTarget._id}`,
            updateData,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        setUploadMsg("Assignment updated successfully!");
        fetchAssignments();
        setTimeout(() => setShowEditPopup(false), 2000);
    } catch (err) {
        console.error("Update failed:", err);
        setUploadMsg("Update failed.");
    } finally {
        setUploading(false);
        setEditFile(null); // Clear file input state
    }
  };

  const handleUpload = async () => {
    if (!title || !file || !dueDate) {
      setUploadMsg("Please provide title, file, and due date.");
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("dueDate", dueDate);
      formData.append("file", file);
      formData.append("classId", id);

      await axios.post(
        "http://localhost:5009/api/assignments/upload",
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUploadMsg("Uploaded successfully!");
      setTitle("");
      setDescription("");
      setFile(null);
      setDueDate("");
      fetchAssignments();
      setTimeout(() => setShowUploadPopup(false), 2000);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadMsg("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const fetchSubmissions = async (assignmentId) => {
    try {
      const res = await axios.get(
        `http://localhost:5009/api/submissions/assignment/${assignmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmissions(res.data.submissions || []);
    } catch (err) {
      console.error("Error fetching submissions:", err);
    }
  };

  const handleUploadSubmission = async () => {
    if (!file || !submissionTarget) return;
    const now = new Date();
    const due = new Date(submissionTarget.dueDate);
    if (now > due) {
      setSubmissionMsg("Submission closed: past due date!");
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assignmentId", submissionTarget._id);

      await axios.post("http://localhost:5009/api/submissions/upload", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSubmissionMsg("Submitted successfully!");
      setFile(null);
      fetchSubmissions(submissionTarget._id);
      setTimeout(() => setShowSubmissionPopup(false), 2000);
    } catch (err) {
      console.error("Submission failed:", err);
     
      setSubmissionMsg("Submission failed. Check console for details."); 
    } finally {
      setUploading(false);
    }
  };

  const fetchAllSubmissions = async (assignmentId) => {
    try {
      const res = await axios.get(
        `http://localhost:5009/api/submissions/assignment/${assignmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAllSubmissions(res.data.submissions || []);
    } catch (err) {
      console.error("Error fetching all submissions:", err);
    }
  };

  const handleViewSubmission = async (submission) => {
    const url = await getSignedUrl("submission", submission._id, "view");
    if (url) window.open(url, "_blank");
  };

  const handleDeleteSubmission = async (submissionId) => {
    try {
      await axios.delete(`http://localhost:5009/api/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Refresh both lists if open
      if (showAllSubmissionsPopup) fetchAllSubmissions(submissionTarget._id);
      if (showSubmissionPopup) fetchSubmissions(submissionTarget._id);
      setSubmissionMsg("Submission deleted.");
    } catch (err) {
      console.error("Delete submission failed:", err);
      setSubmissionMsg("Failed to delete submission.");
    }
  };


  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      <header>
        <div className="left-header">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1>Assignments</h1>
        </div>
        <div
          className="profile"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          ref={dropdownRef}
        >
          {user?.name?.[0]?.toUpperCase()}
          {dropdownOpen && (
            <div className="dropdown">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard">
        <aside className={sidebarOpen ? "open" : ""}>
          {/* UPDATED NAVIGATION BUTTONS */}
          <button onClick={handleHomeClick}>Home</button>
          <button onClick={handleFoldersClick}>Folders</button> 
          <button onClick={handleMeetingClick}>Meeting</button>
          {/* END UPDATED NAVIGATION BUTTONS */}
        </aside>

        <main className={sidebarOpen ? "shifted" : ""}>
          <div className="assignments-page">
            <div className="controls">
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {isTeacher && (
                <button onClick={() => setShowUploadPopup(true)}>
                  + Upload Assignment
                </button>
              )}
            </div>

            <div className="assignments-list">
              {assignments
                .filter((a) =>
                  a.title.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((a) => (
                  <div key={a._id} className="assignment-card">
                    <h3>{a.title}</h3>
                    <p>{a.description}</p>
                    <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>
                      Due:{" "}
                      {a.dueDate
                        ? new Date(a.dueDate).toLocaleString()
                        : "Not set"}
                    </p>
                    <div className="actions">
                      <button onClick={() => handleView(a._id)}>View</button>
                      <button onClick={() => handleDownload(a._id)}>
                        Download
                      </button>

                      {isTeacher ? (
                        <>
                          {/* NEW: Edit button */}
                          <button className="secondary" onClick={() => handleEdit(a)}>Edit</button>
                          <button onClick={() => setDeleteTarget(a)}>Delete</button>
                          <button
                            onClick={() => {
                              setSubmissionTarget(a);
                              fetchAllSubmissions(a._id);
                              setShowAllSubmissionsPopup(true);
                            }}
                          >
                            View Submissions
                          </button>
                        </>
                      ) : (
                        
                        <button
                          onClick={() => {
                            setSubmissionTarget(a);
                            setShowSubmissionPopup(true);
                            fetchSubmissions(a._id);
                            setSubmissionMsg(""); 
                          }}
                        >
                          Submit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Upload Assignment Popup */}
            {showUploadPopup && (
              <div className="popup">
                <div className="popup-header">
                  <h3>Upload Assignment</h3>
                  <button
                    className="close-btn"
                    onClick={() => setShowUploadPopup(false)}
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <label>Due Date:</label>
                <input
                  type="date"
                  min={today}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                {uploadMsg && <p className="popup-msg">{uploadMsg}</p>}
                <div className="popup-actions">
                  <button onClick={handleUpload} disabled={uploading}>
                    {uploading ? "Uploading..." : "Submit"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setShowUploadPopup(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* NEW: Edit Assignment Popup (Updated for File) */}
            {showEditPopup && editTarget && (
                <div className="popup">
                    <div className="popup-header">
                        <h3>Edit Assignment: {editTarget.title}</h3>
                        <button
                            className="close-btn"
                            onClick={() => setShowEditPopup(false)}
                        >
                            ×
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                    />
                    <textarea
                        placeholder="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                    />
                    <label>Due Date:</label>
                    <input
                        type="date"
                        min={today}
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                    />
                    
                    {/* FILE EDIT CONTROLS */}
                    <label style={{ marginTop: '10px' }}>Current File: {editTarget.originalName || "N/A"}</label>
                    <label>Replace File (Optional):</label>
                    <input
                        type="file"
                        onChange={(e) => setEditFile(e.target.files[0])}
                    />
                    {editFile && <p className="popup-msg" style={{color: 'green'}}>New file selected: {editFile.name}</p>}
                    
                    {uploadMsg && <p className="popup-msg">{uploadMsg}</p>}
                    <div className="popup-actions">
                        <button onClick={handleUpdateAssignment} disabled={uploading}>
                            {uploading ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                            className="secondary"
                            onClick={() => setShowEditPopup(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Student Submission Popup */}
           {showSubmissionPopup && submissionTarget && (
              <div className="popup submission-popup">
                <div className="popup-header">
                  <h3>Submit Assignment: {submissionTarget.title}</h3>
                  <button
                    className="close-btn"
                    onClick={() => setShowSubmissionPopup(false)}
                  >
                    ×
                  </button>
                </div>

                <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>
                  Due:{" "}
                  {submissionTarget.dueDate
                    ? new Date(submissionTarget.dueDate).toLocaleString()
                    : "Not set"}
                </p>

                <div className="submission-upload">
                    {/* Updated logic: Check deadline for upload controls */}
                  {submissionTarget.dueDate && new Date() > new Date(submissionTarget.dueDate) ? (
                    <p className="past-due">Submission closed. Past due date.</p>
                  ) : (
                    <>
                      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                      <button onClick={handleUploadSubmission} disabled={uploading}>
                        {uploading ? "Uploading..." : "Submit"}
                      </button>
                    </>
                  )}
                </div>

                {submissionMsg && <p className="popup-msg">{submissionMsg}</p>}

                <div className="submissions-list-student"> {/* Added student list class  */}
                  {submissions.length === 0 ? (
                    <p style={{color: '#5a43aa'}}>No submissions yet.</p>
                  ) : (
                    submissions.map((s) => (
                      <div key={s._id} className="submission-card-student">
                        <div className="submission-info">
                          <span><strong>File:</strong> {s.originalName}</span>
                          {/* Show marks/feedback regardless of due date */}
                          {(s.marks !== null || s.feedback) && ( 
                            <div className="feedback">
                              <p><strong>Marks:</strong> {s.marks ?? 'N/A'}</p>
                              <p><strong>Feedback:</strong> {s.feedback || 'None'}</p>
                            </div>
                          )}
                        </div>
                        <div className="submission-actions">
                          <button onClick={() => handleViewSubmission(s)}>View</button>
                          {/* Allow delete only if before due date */}
                          {submissionTarget.dueDate && new Date() < new Date(submissionTarget.dueDate) && (
                              <button className="danger" onClick={() => handleDeleteSubmission(s._id)}>Delete</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}


            {/* Teacher View & Grade Submissions Popup */}
            {showAllSubmissionsPopup && submissionTarget && (
              <div className="popup">
                <div className="popup-header">
                  <h3>Submissions for: {submissionTarget.title}</h3>
                  <button
                    className="close-btn"
                    onClick={() => setShowAllSubmissionsPopup(false)}
                  >
                    ×
                  </button>
                </div>

                {allSubmissions.length === 0 ? (
                  <p style={{color: '#5a43aa'}}>No submissions yet.</p>
                ) : (
                  <div className="submissions-list-teacher"> {/* Class for scroll view */}
                    {allSubmissions.map((s) => (
                      <div key={s._id} className="submission-card-teacher">
                        <div>
                          <strong>{s.studentId?.name || s.studentId?.email}</strong>
                        </div>
                        <div>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={s.marks ?? ""}
                            placeholder="Marks"
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, e.target.value));
                              const updated = [...allSubmissions];
                              updated.find((sub) => sub._id === s._id).marks = val;
                              setAllSubmissions(updated);
                            }}
                          />
                          <textarea
                            value={s.feedback || ""}
                            placeholder="Feedback"
                            onChange={(e) => {
                              const updated = [...allSubmissions];
                              updated.find((sub) => sub._id === s._id).feedback = e.target.value;
                              setAllSubmissions(updated);
                            }}
                          />
                        </div>
                        <div className="teacher-actions">
                          <button
                            onClick={async () => {
                              try {
                                await axios.patch(
                                  `http://localhost:5009/api/submissions/${s._id}/grade`,
                                  { marks: Number(s.marks), feedback: s.feedback },
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                setGradingMsg("Graded successfully!");
                                fetchAllSubmissions(submissionTarget._id);
                              } catch (err) {
                                console.error("Grading failed:", err);
                                setGradingMsg("Grading failed.");
                              }
                            }}
                          >
                            Save Grade
                          </button>
                          <button onClick={() => handleViewSubmission(s)}>View</button>
                          {/* The 'Delete' button for individual submissions was removed here */}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {gradingMsg && <p className="popup-msg">{gradingMsg}</p>}
                <div className="popup-actions">
                  <button
                    className="secondary"
                    onClick={() => setShowAllSubmissionsPopup(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}


            {/* Delete Assignment Popup */}
            {deleteTarget && (
              <div className="popup">
                <div className="popup-header">
                  <h3>Delete Assignment?</h3>
                  <button
                    className="close-btn"
                    onClick={() => setDeleteTarget(null)}
                  >
                    ×
                  </button>
                </div>
                <p style={{ color: '#5a43aa'}}>{deleteTarget.title}</p>
                <div className="popup-actions">
                  <button onClick={handleDelete}>Yes, Delete</button>
                  <button
                    className="secondary"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default AssignmentsPage;