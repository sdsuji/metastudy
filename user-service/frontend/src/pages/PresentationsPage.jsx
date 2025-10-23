import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./AssignmentsPage.css"; // Reuse the styles
// --- BASE URLS ---
const CLASSROOM_SERVICE_URL = "http://localhost:5001/api";
const USER_SERVICE_SERVICE_URL = "http://localhost:5000/api";
const PRESENTATION_SERVICE_URL = "http://localhost:5011/api";


// =============================================================

// =============================================================
//                 --- FIXED STUDENT SELECTOR COMPONENT ---
// =============================================================
const StudentSelector = ({ classId, onChange, onLoadingChange }) => {
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");

    const fetchStudents = useCallback(async () => {
        if (!classId || !token) {
            setLoading(false);
            onLoadingChange(false);
            return;
        }

        setLoading(true);
        onLoadingChange(true);

        try {
            // STEP 1: Get list of student IDs from the Classroom Service
            const idResponse = await axios.get(
                `${CLASSROOM_SERVICE_URL}/classrooms/${classId}/student-ids`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const studentIds = idResponse.data.studentIds;

            if (studentIds.length === 0) {
                setStudents([]);
                onChange([]);
                return;
            }

            // STEP 2: Get full student details from the User Service using batch lookup
            const idsQuery = studentIds.join(',');
            const usersResponse = await axios.get(
                `${USER_SERVICE_SERVICE_URL}/users/batch?ids=${idsQuery}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Filter for student data (name and _id)
            const studentDetails = usersResponse.data.map(user => ({
                _id: user._id,
                name: user.name,
            }));

            setStudents(studentDetails);

            // Auto-select all students by default for convenience
            const allStudentIds = studentDetails.map(s => s._id);
            setSelectedStudents(allStudentIds);
            onChange(allStudentIds);

        } catch (err) {
            console.error("Error fetching students for selector:", err.response?.data || err.message);
            setStudents([]);
            onChange([]);
        } finally {
            setLoading(false);
            onLoadingChange(false);
        }
    }, [classId, token, onChange, onLoadingChange]);
      

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    const handleSelect = (e) => {
        const value = Array.from(e.target.selectedOptions, option => option.value);
        setSelectedStudents(value);
        onChange(value); // Pass array of IDs back to parent
    };

    return (
        <div className="form-group">
            <label>Assign to:</label>
            {loading ? (
                <p style={{ color: 'gray' }}>Loading students...</p>
            ) : students.length === 0 ? (
                <p style={{ color: 'red' }}>No students found in this class.</p>
            ) : (
                // --- Custom Styled Listbox for Multi-Select ---
                <div className="custom-select-list">
                    {students.map(s => {
                        const isSelected = selectedStudents.includes(s._id);
                        return (
                            <div
                                key={s._id}
                                className={`custom-list-item ${isSelected ? 'selected' : ''}`}
                                onClick={(e) => {
                                    // Simulate multi-select logic without Ctrl/Cmd
                                    // This makes clicking toggle the selection
                                    const newSelected = isSelected
                                        ? selectedStudents.filter(id => id !== s._id)
                                        : [...selectedStudents, s._id];
                                    setSelectedStudents(newSelected);
                                    onChange(newSelected);
                                }}
                            >
                                {s.name}
                            </div>
                        );
                    })}
                </div> 
            )}
            <small>{selectedStudents.length} student(s) selected.</small>
        </div>
    );
};

// =============================================================
const PresentationsPage = () => {
    const { id } = useParams(); // classId
    const [presentations, setPresentations] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [allSubmissions, setAllSubmissions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [studentNameMap, setStudentNameMap] = useState({}); // State for student name mapping
    const [showCreatePopup, setShowCreatePopup] = useState(false);
    const [showSubmissionPopup, setShowSubmissionPopup] = useState(false);
    const [showAllSubmissionsPopup, setShowAllSubmissionsPopup] = useState(false);
    
    // NEW STATE FOR NON-ASSIGNED VIEW
    const [showViewPopup, setShowViewPopup] = useState(false); 
    
    // STATE to track if the StudentSelector is loading
    const [isStudentSelectorLoading, setIsStudentSelectorLoading] = useState(false);

    // States for Presentation Creation
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedStudents, setAssignedStudents] = useState([]); // Array of student IDs
    const [file, setFile] = useState(null);

    // Local messages for popups
    const [msg, setMsg] = useState("");
    const [gradingMsg, setGradingMsg] = useState("");
    const [uploading, setUploading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [submissionTarget, setSubmissionTarget] = useState(null); // The presentation object
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const dropdownRef = useRef(null);
    const token = localStorage.getItem("token");

    const userRef = useRef(JSON.parse(localStorage.getItem("user")));
    const user = userRef.current;
    
    const isTeacher = user?.role === "teacher";
    const userId = user?._id; 

    const navigate = useNavigate();
    const BASE_URL = PRESENTATION_SERVICE_URL; 

    // --- Data Fetching Functions ---

    const fetchPresentations = useCallback(async () => {
        try {
            const res = await axios.get(
                `${BASE_URL}/presentations/class/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPresentations(res.data || []);
            return res.data.map(p => p._id);
        } catch (err) {
            console.error("Error fetching presentations:", err);
            return [];
        }
    }, [id, token]); 
    
    // REFACTORED: Fetch all submissions by iterating over presentations
    const fetchAllSubmissions = useCallback(async (presentationIds) => {
        if (presentationIds.length === 0) {
            setAllSubmissions([]);
            return;
        }

        try {
            // Create a promise for each presentation to fetch its submissions
            const fetchPromises = presentationIds.map(pId =>
                axios.get(`${BASE_URL}/submissions/${pId}`, { headers: { Authorization: `Bearer ${token}` } })
            );

            const responses = await Promise.all(fetchPromises);
            
            // Flatten the array of arrays (submissions for each presentation)
            const combinedSubmissions = responses.flatMap(res => res.data || []);

            setAllSubmissions(combinedSubmissions);
        } catch (err) {
            console.error("Error fetching all submissions:", err);
            setAllSubmissions([]);
        }
    }, [token, BASE_URL]);
    // ----------------------------------------------------------------------
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

    // Main useEffect to load data
    useEffect(() => {
        if (!user || !token) {
            navigate("/option");
            return;
        }

        const loadData = async () => {
            const ids = await fetchPresentations(); // fetches presentations and returns IDs
            // Only fetch all submissions if presentations exist
            if (ids.length > 0) {
                 await fetchAllSubmissions(ids); 
            }
        };
        
        loadData();

    }, [id, token, user, navigate, fetchPresentations, fetchAllSubmissions]);


    // FIX: Fetch all student names in the class for submission display (Teacher view)
    useEffect(() => {
        const fetchStudentNames = async () => {
            if (!id || !token || !isTeacher) return;
            try {
                // STEP 1: Get list of student IDs from the Classroom Service
                const idResponse = await axios.get(
                    `${CLASSROOM_SERVICE_URL}/classrooms/${id}/student-ids`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const studentIds = idResponse.data.studentIds;

                if (studentIds.length === 0) return;

                // STEP 2: Get full student details from the User Service
                const idsQuery = studentIds.join(',');
                const usersResponse = await axios.get(
                    `${USER_SERVICE_SERVICE_URL}/users/batch?ids=${idsQuery}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                // Create map: { studentId: studentName }
                const nameMap = usersResponse.data.reduce((acc, user) => {
                    acc[user._id] = user.name;
                    return acc;
                }, {});

                setStudentNameMap(nameMap);
            } catch (err) {
                console.error("Error fetching student names for map:", err);
            }
        };

        fetchStudentNames();
    }, [id, token, isTeacher]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- File Download Logic (Updated Error Handling) ---
    const getSignedUrl = async (type, fileOwnerId) => {
        try {
            const endpoint =
                type === "presentation"
                    ? `${BASE_URL}/presentations/${fileOwnerId}/file` // fileOwnerId is presentationId
                    : `${BASE_URL}/submissions/file/${fileOwnerId}`; // fileOwnerId is submissionId

            const res = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // Ensure the response contains the necessary data
            if (!res.data || !res.data.url) {
                 throw new Error("Missing URL in signed URL response. Backend issue.");
            }

            return { url: res.data.url, fileName: res.data.fileName };
        } catch (err) {
            console.error("Failed to get signed URL:", err.response?.data || err.message);
            return null; // Return null on error
        }
    };

    const handleDownload = async (id, fileName, type) => {
        setMsg(""); // Clear previous messages
        
        let fileOwnerId;
        if (type === 'submission') {
            fileOwnerId = id; // id is submissionId
        } else if (type === 'presentation') {
            fileOwnerId = id; // id is presentationId
        } else {
            console.error("Invalid download type:", type);
            setMsg("Invalid download type specified.");
            return;
        }
        
        const result = await getSignedUrl(type, fileOwnerId);
        
        if (result) {
            setMsg(`Download link successfully retrieved for ${result.fileName}. Starting download...`);
            const link = document.createElement('a');
            link.href = result.url;
            // Use the file name returned by the server, or fallback to the local name
            link.setAttribute('download', result.fileName || fileName); 
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            // Clear message after a short delay
            setTimeout(() => setMsg(""), 3000); 
        } else {
            // Set error message visible in the popup
            setMsg(`Failed to get download link for file: ${fileName}. This usually means the server blocked the request due to authorization.`); 
        }
    };
    // ----------------------------------------------------

    const fetchSubmissions = async (presentationId, setList) => {
        try {
            const res = await axios.get(
                `${BASE_URL}/submissions/${presentationId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setList(res.data || []);
        } catch (err) {
            console.error("Error fetching submissions:", err);
        }
    };
    
    const handleViewPresentation = (presentation) => {
        setSubmissionTarget(presentation);
        setMsg(""); // Clear message when opening
        setShowViewPopup(true);
    };
    
    // --- Teacher Presentation Actions ---
    const handleDelete = async () => {
        if (!deleteTarget) return;

        try {
            await axios.delete(
                `${BASE_URL}/presentations/${deleteTarget._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Re-fetch all data to update both lists
            const ids = await fetchPresentations();
            await fetchAllSubmissions(ids);
            
            setDeleteTarget(null);
            setMsg("Presentation and all related submissions deleted successfully.");
        } catch (err) {
            console.error("Delete failed:", err);
            setMsg("Failed to delete presentation.");
        }
    };

    const handleCreatePresentation = async () => {
        if (!title || !file) {
            setMsg("Please provide title and presentation file.");
            return;
        }

        if (isStudentSelectorLoading) {
            setMsg("Please wait for student data to load.");
            return;
        }

        if (assignedStudents.length === 0) {
            setMsg("Please select at least one student to assign the presentation, or ensure students are available.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("title", title);
            formData.append("description", description);
            formData.append("file", file);
            formData.append("classId", id);
            // Must be sent as JSON string
            formData.append("assignedStudents", JSON.stringify(assignedStudents)); 

            await axios.post(
                `${BASE_URL}/presentations`,
                formData,
                {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                }
            );

            setMsg("Presentation created successfully!");
            setTitle("");
            setDescription("");
            setFile(null);
            setAssignedStudents([]); 
            
            // Re-fetch all data to update both lists
            const ids = await fetchPresentations();
            await fetchAllSubmissions(ids);
            
            setTimeout(() => setShowCreatePopup(false), 2000);
        } catch (err) {
            console.error("Creation failed:", err);
            setMsg("Creation failed. Ensure all fields are valid.");
        } finally {
            setUploading(false);
        }
    };
    // ------------------------------------


    // --- Submission Actions ---
    const handleUploadSubmission = async () => {
        if (!file || !submissionTarget) return;

        const existingSubmission = submissions.find(s => s.studentId === userId);
        
        if (existingSubmission && existingSubmission.gradedAt) {
            setMsg("Submission is already graded and cannot be modified.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);
            formData.append("presentationId", submissionTarget._id);

            await axios.post(`${BASE_URL}/submissions/upload`, formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });

            setMsg("Submitted successfully! (Replacing previous file if one existed)");
            setFile(null);
            
            // 1. Refresh student's own submission view
            fetchSubmissions(submissionTarget._id, setSubmissions);
            
            // 2. Refresh ALL submissions so non-assigned students can see the new file
            const presentationIds = presentations.map(p => p._id);
            fetchAllSubmissions(presentationIds);

            setTimeout(() => setMsg(""), 3000);
        } catch (err) {
            console.error("Submission failed:", err);
            const errorMsg = err.response?.data?.error || "Submission failed. Check console for details.";
            setMsg(`  ❌   ${errorMsg}`);
        } finally {
            setUploading(false);
        }
    };

    const handleGradeSubmission = async (submission) => {
        // Ensure marks is a number before validation/sending
        const marksValue = submission.marks === "" || submission.marks === null ? null : Number(submission.marks);
        
        // Basic validation
        if (marksValue !== null && (isNaN(marksValue) || marksValue < 0 || marksValue > 100)) {
            setGradingMsg("Marks must be between 0 and 100.");
            return;
        }

        try {
            await axios.put(
                `${BASE_URL}/submissions/grade/${submission._id}`,
                { 
                    marks: marksValue, // Send null if marks were cleared/not set, otherwise send number
                    feedback: submission.feedback 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setGradingMsg("Graded successfully!");
            // Refresh the teacher's list
            // NOTE: The visual state is already updated locally via setAllSubmissions in the onChange handlers
            // For a persistent save:
            // fetchSubmissions(submissionTarget._id, setAllSubmissions); // This re-fetches the list, confirming the save.
            
        } catch (err) {
            console.error("Grading failed:", err);
            setGradingMsg("Grading failed.");
        }
    };
    // ------------------------------

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/option");
    };

    // Filter presentations based on search term
    const filteredPresentations = presentations
        .filter((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

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
                    <h1>Presentations</h1>
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
                    <div className="assignments-page"> {/* Reusing assignments-page class */}
                        <div className="controls">
                            <input
                                type="text"
                                placeholder="Search presentations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {isTeacher && (
                                <button onClick={() => {
                                    setShowCreatePopup(true);
                                    setMsg(""); // clear previous messages
                                }}>
                                    + Create Presentation
                                </button>
                            )}
                        </div>

                        <div className="assignments-list">
                            {/* --- PRESENTATION CARD RENDERING LOGIC --- */}
                            {filteredPresentations.map((presentation) => {
                                // Find the *current user's* submission (for assigned students)
                                const submission = allSubmissions.find(
                                    (s) => s.studentId === userId && s.presentationId === presentation._id
                                );

                                // Check if the presentation was assigned to the current user
                                const isAssigned =
                                    presentation.assignedStudents.length === 0 ||
                                    presentation.assignedStudents.includes(userId);
                                
                                // ----------------------------------------------------
                                // CARD RENDER START
                                // ----------------------------------------------------

                                // Renders the existing Teacher/Assigned Student Card
                                if (isTeacher || isAssigned) {
                                    return (
                                        <div key={presentation._id} className="assignment-card">
                                            <h3>{presentation.title}</h3>
                                            <p>{presentation.description}</p>
                                        
                                            <div className="actions">
                                                {presentation.fileId && (
                                                    <>
                                                        {/* Teacher's File Download */}
                                                        <button onClick={() => handleDownload(presentation._id, presentation.originalName, 'presentation')}>
                                                            Download
                                                        </button>
                                                    </>
                                                )}

                                                {isTeacher ? (
                                                    // Teacher Actions
                                                    <>
                                                        <button
                                                            className="secondary"
                                                            onClick={() => setDeleteTarget(presentation)}
                                                        >
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSubmissionTarget(presentation);
                                                                // allSubmissions is already populated on load
                                                                setShowAllSubmissionsPopup(true);
                                                                setGradingMsg("");
                                                            }}
                                                        >
                                                            Submissions
                                                        </button>
                                                    </>
                                                ) : (
                                                    // Assigned Student Actions (Submit/View Grade)
                                                    <button
                                                        onClick={() => {
                                                            setSubmissionTarget(presentation);
                                                            // Fetch student's own submission/status specifically
                                                            fetchSubmissions(presentation._id, setSubmissions); 
                                                            setShowSubmissionPopup(true);
                                                            setMsg("");
                                                        }}
                                                    >
                                                        {submission ? (submission.gradedAt ? "View Grade" : "Edit Submission") : "Submit"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                // Renders the NEW Non-Assigned Student Card (View Only)
                                else {
                                    return (
                                        <div key={presentation._id} className="assignment-card unassigned-card">
                                            <h3>{presentation.title} </h3>
                                            <p className="description-text">{presentation.description}</p>
                                            <p>
                                                Files: {presentation.originalName ? presentation.originalName : 'None'}
                                            </p>
                                            
                                            {/* --- FIX: Use the 'actions' div for consistent button layout --- */}
                                            <div className="actions"> 
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleViewPresentation(presentation)}
                                                >
                                                    View Presentation
                                                </button>
                                            </div>
                                            {/* --------------------------------------------------------------- */}
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    </div>
                    
                    {/* --- NON-ASSIGNED STUDENT: VIEW POPUP (Uses pre-fetched allSubmissions) --- */}
                    {showViewPopup && submissionTarget && (
                        <div className="popup">
                            <div className="popup-header">
                                <h3> {submissionTarget.title}</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => {
                                        setShowViewPopup(false);
                                        setMsg(""); // Clear message on close
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* --- ADDED: Display message/error from handleDownload --- */}
                            {/*msg && <p className="popup-msg" style={{ marginBottom: '15px', color: msg.startsWith(' ❌') ? 'red' : 'green' }}>{msg}</p>*/} 
                            {/* ---------------------------------------------------------- */}
                            
                            {/* CRITICAL CHECK: Look for *any* submission with a file attached (checking both fileName and originalName) */}
                            {(() => {
                                const uploadedSubmission = allSubmissions.find(s => 
                                    s.presentationId === submissionTarget._id && 
                                    (s.fileName || s.originalName)
                                );

                                if (uploadedSubmission) {
                                    return (
                                        <>
                                            <h4>Download Solution File:</h4>
                                            <div style={{ marginTop: '15px' }}>
                                                <div className="actions"> 
                                                 <button
                                                    className="secondary-btn"
                                                    onClick={() => {
                                                        handleDownload(
                                                            uploadedSubmission._id, 
                                                            uploadedSubmission.originalName || uploadedSubmission.fileName,
                                                            "submission"
                                                        );
                                                    }}
                                                >
                                                    Download Presentation
                                                </button>
                                            </div>
                                               
                                            </div>
                                           
                                        </>
                                    );
                                } else {
                                    return (
                                        <p style={{ color: 'red', fontWeight: 'bold' }}>
                                            No materials have been uploaded by assigned students.
                                        </p>
                                    );
                                }
                            })()}
                            
                            <hr style={{ margin: '20px 0' }} />
                            
                            {/* Option to download the teacher's question file is kept separate for clarity */}
                            {submissionTarget.fileId ? (
                                <div style={{ marginTop: '15px' }}>
                                    <h4>Download Question File:</h4>
                                    <div className="actions"> 
                                                <button
                                        className="secondary-btn"
                                        onClick={() =>
                                            handleDownload(
                                                submissionTarget._id, 
                                                submissionTarget.originalName,
                                                "presentation"
                                            )
                                        }
                                    >
                                        Question ({submissionTarget.originalName})
                                    </button>
                                            </div>
                                   
                                </div>
                            ) : (
                                <p style={{ color: 'gray' }}>Question file not available.</p>
                            )}
                            
                            <div className="popup-actions" style={{ marginTop: '30px' }}>
                                <button
                                    className="secondary"
                                    onClick={() => {
                                        setShowViewPopup(false);
                                        setMsg("");
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* --- TEACHER: Create Presentation Popup (Adapted) --- */}
                    {showCreatePopup && (
                        <div className="popup">
                            <div className="popup-header">
                                <h3>Create Presentation</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowCreatePopup(false)}
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
                            {/* Student Selector for assignedStudents */}
                            <StudentSelector
                                classId={id}
                                onChange={setAssignedStudents}
                                onLoadingChange={setIsStudentSelectorLoading} // Pass the setter
                            />
                            <input
                                type="file"
                                onChange={(e) => setFile(e.target.files[0])}
                            />
                            <p className="file-status">{file ? `Selected: ${file.name}` : 'No file chosen'}</p> {/* Added for feedback */}
                            {msg && <p className="popup-msg">{msg}</p>}
                            <div className="popup-actions">
                                <button
                                    onClick={handleCreatePresentation}
                                    disabled={uploading || isStudentSelectorLoading || assignedStudents.length === 0} // Disable when loading or no students
                                >
                                    {uploading ? "Creating..." : "Create"}
                                </button>
                                <button
                                    className="secondary"
                                    onClick={() => setShowCreatePopup(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- STUDENT: Submission Popup (Adapted) --- */}
                    {showSubmissionPopup && submissionTarget && (
                        <div className="popup submission-popup">
                            <div className="popup-header">
                                <h3>Submission for: {submissionTarget.title}</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => {
                                        setShowSubmissionPopup(false);
                                        setFile(null);
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {submissions.length > 0 ? (
                                <>
                                    <h4 style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>Your Submission Status:</h4>
                                    <div className="submission-status-card">
                                        <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>File: {submissions[0].originalName}</p>
                                        <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>
                                            Status:{" "}
                                            {submissions[0].gradedAt
                                                ? `Graded (${submissions[0].marks} mark - ${submissions[0].feedback || 'No feedback'})`
                                                : "Submitted, Awaiting Grade"}
                                        </p>

                                        <div className="actions">
                                            <button onClick={() => handleDownload(submissions[0]._id, submissions[0].originalName, 'submission')}>Download My File</button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p style={{ marginTop: '10px' ,color: '#5a43aa', marginBottom: '10px'}}>No submission found. Upload your file below.</p>
                            )}

                            <hr />
                            <h4 style={{ color: '#5a43aa'}}>{submissions.length > 0 ? "Replace File" : "Upload File"}</h4>
                            <input
                                type="file"
                                onChange={(e) => setFile(e.target.files[0])}
                            />
                            <p style={{color: '#5a43aa'}} className="file-status">{file ? `Selected: ${file.name}` : 'No file chosen'}</p> {/* Added for feedback */}
                            {msg && <p className="popup-msg">{msg}</p>}

                            <div className="popup-actions">
                                <button
                                    onClick={handleUploadSubmission}
                                    disabled={uploading || !file || submissions[0]?.gradedAt}
                                >
                                    {uploading ? "Uploading..." : (submissions[0]?.gradedAt ? "Graded (Cannot Change)" : "Submit/Replace")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- TEACHER: View & Grade Submissions Popup (Updated Structure) --- */}
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

                            {/* Filter submissions relevant to the current presentation */}
                            {allSubmissions.filter(s => s.presentationId === submissionTarget._id).length === 0 ? (
                                <p style={{ color: '#5a43aa'}}>No submissions yet.</p>
                            ) : (
                                <div className="submissions-list-teacher">
                                    {allSubmissions.filter(s => s.presentationId === submissionTarget._id).map((s) => (
                                        <div key={s._id} className="submission-card-teacher">
                                            <div className="submission-info">
                                                {/* Use studentNameMap for displaying student name */}
                                                <strong>{studentNameMap[s.studentId] || s.studentId}</strong>
                                                <span>{s.originalName}</span>
                                                <span className={s.gradedAt ? "graded" : "submitted"}>{s.gradedAt ? 'GRADED' : 'SUBMITTED'}</span>
                                            </div>
                                            
                                            <div className="grading-controls">
                                                {/* Input for Marks */}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={s.marks ?? ""}
                                                    placeholder="Marks"
                                                    onChange={(e) => {
                                                        // Ensure value is bounded between 0 and 100, or empty string
                                                        let val = e.target.value === "" ? "" : Number(e.target.value);
                                                        if (val !== "") {
                                                            val = Math.min(100, Math.max(0, val));
                                                        }
                                                        
                                                        setAllSubmissions(prev => 
                                                            prev.map(sub => sub._id === s._id ? { ...sub, marks: val, feedback: sub.feedback } : sub)
                                                        );
                                                        setGradingMsg(""); // Clear message on change
                                                    }}
                                                />
                                                {/* Textarea for Feedback */}
                                                <textarea
                                                    value={s.feedback || ""}
                                                    placeholder="Feedback"
                                                    onChange={(e) => {
                                                        setAllSubmissions(prev => 
                                                            prev.map(sub => sub._id === s._id ? { ...sub, feedback: e.target.value, marks: sub.marks } : sub)
                                                        );
                                                        setGradingMsg(""); // Clear message on change
                                                    }}
                                                />
                                            </div>
                                            <div className="teacher-actions">
                                                <button onClick={() => handleGradeSubmission(s)}>
                                                    Save Grade
                                                </button>
                                                {/* CORRECTED DOWNLOAD CALL: Uses the submission ID, filename, and type */}
                                                <button onClick={() => handleDownload(s._id, s.originalName, 'submission')}>
                                                    Download
                                                </button>
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
                    
                    {/* --- DELETE Confirmation Popup --- */}
                    {deleteTarget && (
                        <div className="popup">
                            <div className="popup-header">
                                <h3>Delete Presentation?</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => setDeleteTarget(null)}
                                >
                                    ×
                                </button>
                            </div>
                            <p>Are you sure you want to
delete presentation: <strong>{deleteTarget.title}</strong>? This action will also **delete all student submissions**
for this presentation, including their files from S3.</p>
                            <div className="popup-actions">
                                <button className="danger" onClick={handleDelete}>Yes, Delete</button>
                                <button
                                    className="secondary"
                                    onClick={() => setDeleteTarget(null)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default PresentationsPage;