import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom"; // CORRECTED: was "react-router-router-dom"
import './TestsPage.css'; // Assuming the CSS file is shared

// !!! IMPORTANT: Ensure the API base URL matches your backend service port (e.g., 5012)
const API_BASE_URL = "http://localhost:5012/api";

const TestsPage = () => {
    const { id } = useParams(); // classId
    const [tests, setTests] = useState([]); // List of tests
    const [submissions, setSubmissions] = useState([]); // Student's submissions for the selected test
    const [allSubmissions, setAllSubmissions] = useState([]); // All submissions for teacher
    const [searchTerm, setSearchTerm] = useState("");

    // NEW STATE: To track the student's latest submission status for quick lookup
    const [studentSubmissionStatus, setStudentSubmissionStatus] = useState({});

    // Popup states
    const [showUploadPopup, setShowUploadPopup] = useState(false);
    const [showSubmissionPopup, setShowSubmissionPopup] = useState(false);
    const [showAllSubmissionsPopup, setShowAllSubmissionsPopup] = useState(false);
    const [showEditPopup, setShowEditPopup] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // *** REMOVED STATE: showConfirmClearSubmissions is removed. ***

    // State for Editing/Targeting
    const [editTarget, setEditTarget] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    // State for optional file update on edit
    const [newQuestionFile, setNewQuestionFile] = useState(null); 
    const [submissionTarget, setSubmissionTarget] = useState(null); // The test being submitted to

    // State for New Test Upload
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [questionFile, setQuestionFile] = useState(null); // File for upload (Test Question or Student Submission)
    const [solutionFile, setSolutionFile] = useState(null); // File for Auto-Grading solution
    const [gradingMethod, setGradingMethod] = useState("manual");

    // Local messages
    const [uploadMsg, setUploadMsg] = useState("");
    const [submissionMsg, setSubmissionMsg] = useState("");
    const [gradingMsg, setGradingMsg] = useState("");
    const [uploading, setUploading] = useState(false);

    // UI state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const dropdownRef = useRef(null);

    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));
    const isTeacher = user?.role === "teacher";
    const navigate = useNavigate();

    const today = new Date().toISOString().split("T")[0];

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
        fetchTests();
    }, [id, token, user, navigate]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Function to fetch student's latest submission status
    const fetchStudentLatestSubmissionStatus = async (testId) => {
        if (isTeacher) return null; 

        try {
            const res = await axios.get(
                `${API_BASE_URL}/submissions/test/${testId}/my/latest`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return res.data.submission || null;
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error(`Error fetching latest submission for test ${testId}:`, err);
            }
            return null;
        }
    };

    const fetchTests = async () => {
        try {
            const res = await axios.get(
                `${API_BASE_URL}/tests/class/${id}`, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const fetchedTests = res.data.tests || [];
            setTests(fetchedTests);

            if (!isTeacher && fetchedTests.length > 0) {
                const statusUpdates = {};
                for (const test of fetchedTests) {
                    const status = await fetchStudentLatestSubmissionStatus(test._id);
                    statusUpdates[test._id] = status;
                }
                setStudentSubmissionStatus(statusUpdates);
            }

        } catch (err) {
            console.error("Error fetching tests:", err);
        }
    };

    const getSignedUrl = async (type, id, action = "view") => {
        try {
            const url =
                type === "test"
                    ? `${API_BASE_URL}/tests/${id}/signed-url`
                    : `${API_BASE_URL}/submissions/${id}/signed-url`;

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

    const handleView = async (testId) => {
        const url = await getSignedUrl("test", testId, "view");
        if (url) window.open(url, "_blank");
    };

    const handleDownload = async (testId) => {
        const url = await getSignedUrl("test", testId, "download");
        if (url) window.open(url, "_blank");
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(
                `${API_BASE_URL}/tests/${deleteTarget._id}`, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchTests();
            setDeleteTarget(null);
            setUploadMsg("Test deleted successfully.");
        } catch (err) {
            console.error("Delete failed:", err);
            setUploadMsg("Failed to delete test.");
        }
    };

    const handleEdit = (test) => {
        setEditTarget(test);
        setEditTitle(test.title);
        setEditDescription(test.description || "");
        const formattedDate = test.dueDate ? new Date(test.dueDate).toISOString().split('T')[0] : '';
        setEditDueDate(formattedDate);
        setNewQuestionFile(null); 
        setUploadMsg("");
        setShowEditPopup(true);
    };

    // --- UPDATED LOGIC: Update Test without Clearing Submissions ---
    const handleUpdateTest = () => {
        if (!editTarget || !editTitle || !editDueDate) {
            setUploadMsg("Title and due date are required.");
            return;
        }
        // Always proceed directly with update, regardless of file change.
        performUpdate();
    };

    // --- UPDATED FUNCTION: Performs the actual API calls (Clear Submissions Logic Removed) ---
    const performUpdate = async () => {
        // setShowConfirmClearSubmissions(false); // Removed modal closing logic

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("title", editTitle);
            formData.append("description", editDescription);
            formData.append("dueDate", editDueDate);

            if (newQuestionFile) {
                formData.append("questionFile", newQuestionFile);
                // Note: The logic to clear submissions has been removed here.
            }

            // 1. UPDATE THE TEST METADATA/FILE
            await axios.patch(
                `${API_BASE_URL}/tests/${editTarget._id}`, 
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setUploadMsg(`Test updated successfully!`);
            fetchTests();
            setNewQuestionFile(null); 
            setTimeout(() => setShowEditPopup(false), 2000);
        } catch (err) {
            console.error("Update failed:", err);
            setUploadMsg(`Update failed: ${err.response?.data?.msg || err.message}`);
        } finally {
            setUploading(false);
        }
    };


    const handleCreateTest = async () => {
        if (!title || !questionFile || !dueDate) {
            setUploadMsg("Please provide title, question file, and due date.");
            return;
        }
        if (gradingMethod === 'auto' && !solutionFile) {
            setUploadMsg("Auto-Grading requires a Solution File.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("title", title);
            formData.append("description", description);
            formData.append("dueDate", dueDate);
            formData.append("classId", id);
            formData.append("gradingMethod", gradingMethod);

            formData.append("questionFile", questionFile); 

            if (solutionFile && gradingMethod === 'auto') {
                formData.append("solutionFile", solutionFile); 
            }

            await axios.post(
                `${API_BASE_URL}/tests/create`, 
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setUploadMsg("Test created successfully!");
            setTitle(""); setDescription(""); setQuestionFile(null); setSolutionFile(null);
            setDueDate(""); setGradingMethod("manual");
            fetchTests();
            setTimeout(() => setShowUploadPopup(false), 2000);
        } catch (err) {
            console.error("Test creation failed:", err);
            setUploadMsg(`Creation failed: ${err.response?.data?.msg || err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const fetchSubmissions = async (testId) => {
        try {
            const res = await axios.get(
                `${API_BASE_URL}/submissions/test/${testId}`, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSubmissions(res.data.submissions || []);
        } catch (err) {
            console.error("Error fetching submissions:", err);
        }
    };

    const handleUploadSubmission = async () => {
        const submissionFile = questionFile; 
        if (!submissionFile || !submissionTarget) return;

        const now = new Date();
        const due = new Date(submissionTarget.dueDate);
        const latestSubmission = studentSubmissionStatus[submissionTarget._id];

        if (latestSubmission && latestSubmission.gradedAt) {
            setSubmissionMsg("Submission failed: Test has already been graded.");
            return;
        }
        if (now > due) {
            setSubmissionMsg("Submission failed: past due date!");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", submissionFile); 
            formData.append("testId", submissionTarget._id);

            await axios.post(`${API_BASE_URL}/submissions/upload`, formData, { 
                headers: { Authorization: `Bearer ${token}` },
            });

            setSubmissionMsg("Submitted successfully!");
            setQuestionFile(null); 
            fetchSubmissions(submissionTarget._id);

            const newStatus = await fetchStudentLatestSubmissionStatus(submissionTarget._id);
            setStudentSubmissionStatus(prev => ({
                ...prev,
                [submissionTarget._id]: newStatus
            }));

            setTimeout(() => setShowSubmissionPopup(false), 2000);
        } catch (err) {
            console.error("Submission failed:", err);
            setSubmissionMsg(`Submission failed: ${err.response?.data?.msg || "Check console for details."}`);
        } finally {
            setUploading(false);
        }
    };

    const fetchAllSubmissions = async (testId) => {
        try {
            const res = await axios.get(
                `${API_BASE_URL}/submissions/test/${testId}`, 
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

    const handleGradeSubmission = async (submission) => {
        try {
            await axios.patch(
                `${API_BASE_URL}/submissions/${submission._id}/grade`, 
                {
                    marks: submission.marks, 
                    feedback: submission.feedback
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setGradingMsg("Graded successfully!");
            fetchAllSubmissions(submissionTarget._id);
            fetchTests(); 
            setTimeout(() => setGradingMsg(""), 3000);
        } catch (err) {
            console.error("Grading failed:", err);
            setGradingMsg("Grading failed.");
        }
    };


    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/option");
    };


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
                    <h1>Tests</h1>
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
                    <button onClick={() => navigate("/dashboard")}>Home</button>
                    <button onClick={() => { navigate(`/classroom/${id}`); setSidebarOpen(false);}}>Folders</button> 
                    <button>Meeting</button>
                </aside>

                <main className={sidebarOpen ? "shifted" : ""}>
                    <div className="assignments-page">
                        <div className="controls">
                            <input
                                type="text"
                                placeholder="Search tests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {isTeacher && (
                                <button onClick={() => setShowUploadPopup(true)}>
                                    + Create Test
                                </button>
                            )}
                        </div>

                        <div className="assignments-list">
                            {tests
                                .filter((a) => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((a) => {
                                    const latestSubmission = studentSubmissionStatus[a._id];
                                    const hasSubmission = !!latestSubmission;
                                    const isGraded = hasSubmission && !!latestSubmission.gradedAt;
                                    const isPastDue = a.dueDate && new Date() > new Date(a.dueDate);

                                    let studentActionText = "Submit";
                                    let studentActionDisabled = isPastDue || isGraded; 

                                    if (isGraded) {
                                        studentActionText = `Graded`; 
                                        studentActionDisabled = false; 
                                    } else if (isPastDue) {
                                        studentActionText = "Past Due";
                                    } else if (hasSubmission) {
                                        studentActionText = "View";
                                        studentActionDisabled = false; 
                                    } else {
                                        studentActionDisabled = false; 
                                    }

                                    return (
                                        <div key={a._id} className="assignment-card">
                                            <h3>{a.title}</h3>
                                            <p>{a.description}</p>
                                            <p>
                                                Grading: <span style={{ fontWeight: 'bold', color: a.gradingMethod === 'auto' ? '#6495ED' : '#0F52BA' }}>{a.gradingMethod.toUpperCase()}</span>
                                            </p>
                                            <p>
                                                Due:{" "}
                                                {a.dueDate ? new Date(a.dueDate).toLocaleString() : "Not set"}
                                            </p>
                                            <div className="actions">
                                                <button onClick={() => handleView(a._id)}>Question</button>
                                                <button onClick={() => handleDownload(a._id)}>
                                                    Download
                                                </button>

                                                {isTeacher ? (
                                                    <>
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
                                                            setQuestionFile(null); 
                                                        }}
                                                        disabled={studentActionDisabled && !isGraded} 
                                                        style={{
                                                            backgroundColor: isGraded ? 'green' : (isPastDue ? '#dc3545' : ''),
                                                            color: isGraded || isPastDue ? 'white' : ''
                                                        }}
                                                    >
                                                        {studentActionText}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* --- Upload Test Popup (Teacher) --- */}
                        {showUploadPopup && (
                            <div className="popup">
                                <div> 
                                    <div className="popup-header">
                                        <h3>Create New Test</h3>
                                        <button
                                            className="close-btn"
                                            onClick={() => setShowUploadPopup(false)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <input type="text" placeholder="Test Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                                    <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

                                    <div style={{ marginBottom: '15px',color: '#5a43aa'}}>
                                        <label>Grading Method:</label>
                                        <select value={gradingMethod} onChange={(e) => { setGradingMethod(e.target.value); setSolutionFile(null); }}>
                                            <option value="manual">Manual Grading</option>
                                            <option value="auto">Auto-Grading (Standardized Template)</option>
                                        </select>
                                    </div>
                                    
                                    <div style={{ marginBottom: '15px' }}>
                                        <label>Due Date:</label>
                                        <input type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                    </div>

                                    <label style={{ marginTop: '10px' }}>Question File (Template):</label>
                                    <input type="file" onChange={(e) => setQuestionFile(e.target.files[0])} />

                                    {gradingMethod === 'auto' && (
                                        <>
                                            <p style={{ marginTop: '10px', color: '#cc0000', fontWeight: 'bold' }}>
                                                **Required for Auto-Grade:** Solution File.
                                            </p>
                                            <label>Solution File (Answer Key):</label>
                                            <input type="file" onChange={(e) => setSolutionFile(e.target.files[0])} required />
                                        </>
                                    )}

                                    {uploadMsg && <p className="popup-msg">{uploadMsg}</p>}
                                    <div className="popup-actions">
                                        <button onClick={handleCreateTest} disabled={uploading}>
                                            {uploading ? "Creating..." : "Create Test"}
                                        </button>
                                        <button className="secondary" onClick={() => setShowUploadPopup(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- Edit Test Popup (Teacher) --- */}
                        {showEditPopup && editTarget && (
                            <div className="popup">
                                <div>
                                    <div className="popup-header">
                                        <h3>Edit Test: {editTarget.title}</h3>
                                        <button className="close-btn" onClick={() => setShowEditPopup(false)}>×</button>
                                    </div>
                                    <input type="text" placeholder="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                    <textarea placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                                    
                                    <div style={{ marginBottom: '15px' }}>
                                        <label>Due Date:</label>
                                        <input type="date" min={today} value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                                    </div>

                                    <div style={{ marginBottom: '15px' }}>
                                        <label>
                                            Question File (Optional Update):
                                        </label>
                                        <p style={{ fontSize: '0.85em', color: '#5a43aa', padding: '5px' }}>
                                            Current file: {editTarget.originalName}. Upload a new file to replace it.
                                            {/* WARNING NOTE REMOVED */}
                                        </p>
                                        <input 
                                            type="file" 
                                            onChange={(e) => setNewQuestionFile(e.target.files[0])} 
                                        />
                                        {newQuestionFile && 
                                            <p style={{ fontSize: '0.85em', color: 'blue' }}>
                                                New file selected: {newQuestionFile.name}
                                            </p>
                                        }
                                    </div>

                                    <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>Grading Method: {editTarget.gradingMethod.toUpperCase()}</p>
                                    {uploadMsg && <p className="popup-msg">{uploadMsg}</p>}
                                    <div className="popup-actions">
                                        {/* Button calls the new entry point handleUpdateTest */}
                                        <button onClick={handleUpdateTest} disabled={uploading}>
                                            {uploading ? "Saving..." : "Save Changes"}
                                        </button>
                                        <button className="secondary" onClick={() => setShowEditPopup(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- REMOVED: Custom Confirmation Modal JSX Block --- */}
                        {/* The following block was removed to stop asking the teacher to clear submissions:
                        {showConfirmClearSubmissions && (
                            <div className="popup"> ... </div>
                        )}
                        */}


                        {/* --- Student Submission Popup (Student) --- */}
                        {showSubmissionPopup && submissionTarget && (
                            <div className="popup submission-popup">
                                <div>
                                    <div className="popup-header">
                                        <h3>Submit Test: {submissionTarget.title}</h3>
                                        <button className="close-btn" onClick={() => setShowSubmissionPopup(false)}>×</button>
                                    </div>

                                    <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>Due: {submissionTarget.dueDate ? new Date(submissionTarget.dueDate).toLocaleString() : "Not set"}</p>
                                    <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>Grading: {submissionTarget.gradingMethod.toUpperCase()}</p>

                                    {/* --- Submission Logic --- */}
                                    {(() => {
                                        const latestSubmission = studentSubmissionStatus[submissionTarget._id];
                                        const isGraded = !!latestSubmission?.gradedAt;
                                        const isPastDue = submissionTarget.dueDate && new Date() > new Date(submissionTarget.dueDate);
                                        const hasSubmission = !!latestSubmission;

                                        if (isGraded) {
                                            return <p className="past-due" style={{ color: 'green', fontWeight: 'bold' }}> This test has been GRADED. No further changes allowed.</p>;
                                        }

                                        if (isPastDue) {
                                            return <p className="past-due" style={{ color: '#dc3545', fontWeight: 'bold' }}> Submission closed. Past due date.</p>;
                                        }

                                        return (
                                            <div className="submission-upload">
                                                {hasSubmission && <p style={{ color: '#5d4291' }}>A submission already exists. Uploading a new file will overwrite it.</p>}
                                                <input type="file" onChange={(e) => setQuestionFile(e.target.files[0])} />
                                                <button onClick={handleUploadSubmission} disabled={uploading}>
                                                    {uploading ? "Uploading..." : (hasSubmission ? "Resubmit" : "Submit")}
                                                </button>
                                            </div>
                                        );
                                    })()}
                                    {/* ------------------------ */}

                                    {submissionMsg && <p className="popup-msg">{submissionMsg}</p>}

                                    <div className="submissions-list-student">
                                        <h4 style={{ marginTop: '15px' , color: '#5d4291' }}>Your Submission History</h4>
                                        {submissions.length === 0 ? (
                                            <p>No submissions yet.</p>
                                        ) : (
                                            submissions.map((s) => (
                                                <div key={s._id} className="submission-card-student">
                                                    <div className="submission-info">
                                                        <span><strong>File:</strong> {s.originalName}</span>
                                                        <p><strong>Submitted:</strong> {new Date(s.uploadedAt).toLocaleString()}</p>
                                                        <p>
                                                            <strong>Status:</strong> 
                                                            <span style={{color: s.gradedAt ? 'green' : '#5d4291', fontWeight: 'bold', marginLeft: '5px'}}>
                                                                {s.gradedAt ? 'GRADED' : s.autoGradeStatus.toUpperCase()}
                                                            </span>
                                                        </p>
                                                        
                                                        {(s.gradedAt || s.marks !== null || (s.feedback && s.feedback !== "")) && (
                                                            <div className="feedback">
                                                                <p style={{marginTop: '5px'}}>
                                                                    <strong>Marks:</strong> 
                                                                    <span style={{fontWeight: 'bold', color: s.marks === null ? 'red' : 'green', marginLeft: '5px'}}>
                                                                        {s.marks ?? 'N/A'}
                                                                    </span>
                                                                </p>
                                                                {(s.gradedBy && s.gradedBy.toString() === 'auto-grader-system') && <p style={{ color: 'blue' }}>*(Auto-Graded)*</p>}
                                                                {(s.feedback && s.feedback !== "") && (
                                                                    <>
                                                                        <p style={{fontWeight: 'bold', marginTop: '5px'}}>Feedback:</p>
                                                                        <textarea readOnly value={s.feedback} style={{ width: '100%', minHeight: '80px', resize: 'none' }} />
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="submission-actions">
                                                        <button onClick={() => handleViewSubmission(s)}>View File</button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* --- Teacher View & Grade Submissions Popup (Teacher) --- */}
                        {showAllSubmissionsPopup && submissionTarget && (
                            <div className="popup">
                                <div>
                                    <div className="popup-header">
                                        <h3>Submissions for: {submissionTarget.title}</h3>
                                        <button className="close-btn" onClick={() => setShowAllSubmissionsPopup(false)}>×</button>
                                    </div>
                                    <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>Grading Method: {submissionTarget.gradingMethod.toUpperCase()}</p>

                                    {allSubmissions.length === 0 ? (
                                        <p>No submissions yet.</p>
                                    ) : (
                                        <div className="submissions-list-teacher">
                                            {allSubmissions.map((s) => (
                                                <div key={s._id} className="submission-card-teacher">
                                                    <div>
                                                        <strong>{s.studentId?.name || s.studentId?.email}</strong>
                                                        <span style={{ float: 'right', color: s.gradedAt ? 'green' : (s.autoGradeStatus === 'error' ? 'red' : 'orange') }}>
                                                            {s.gradedAt ? 'GRADED' : s.autoGradeStatus.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    
                                                    <div>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="10"
                                                            value={s.marks ?? ""}
                                                            placeholder="Mark max-10"
                                                            onChange={(e) => {
                                                                const inputVal = e.target.value;
                                                                let val = inputVal === "" ? null : Number(inputVal);
                                                                if (val !== null) {
                                                                    val = Math.min(10, Math.max(0, val));
                                                                }
                                                                setAllSubmissions(prev => prev.map(sub =>
                                                                    sub._id === s._id ? { ...sub, marks: val } : sub
                                                                ));
                                                            }}
                                                        />
                                                        <textarea
                                                            value={s.feedback || ""}
                                                            placeholder="Feedback"
                                                            onChange={(e) => {
                                                                setAllSubmissions(prev => prev.map(sub =>
                                                                    sub._id === s._id ? { ...sub, feedback: e.target.value } : sub
                                                                ));
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="teacher-actions">
                                                        <button onClick={() => handleGradeSubmission(s)}>
                                                            Save Grade
                                                        </button>
                                                        <button onClick={() => handleViewSubmission(s)}>View</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {gradingMsg && <p className="popup-msg">{gradingMsg}</p>}
                                    <div className="popup-actions">
                                        <button className="secondary" onClick={() => setShowAllSubmissionsPopup(false)}>Close</button>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* ... Delete Test Popup ... */}
                        {deleteTarget && (
                            <div className="popup">
                                <div>
                                    <div className="popup-header">
                                        <h3>Delete Test?</h3>
                                        <button className="close-btn" onClick={() => setDeleteTarget(null)}>×</button>
                                    </div>
                                    <p>{deleteTarget.title}</p>
                                    <div className="popup-actions">
                                        <button onClick={handleDelete}>Yes, Delete</button>
                                        <button className="secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
};

export default TestsPage;