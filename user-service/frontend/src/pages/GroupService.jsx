import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./GroupService.css"; 

// --- BASE URLS ---
const CLASSROOM_SERVICE_URL = "http://localhost:5001/api";
const USER_SERVICE_SERVICE_URL = "http://localhost:5000/api";
// Set the URL for your new Group Service
const GROUP_SERVICE_URL = "http://localhost:5020/api"; 
// =============================================================

// =============================================================
//                   --- STUDENT SELECTOR COMPONENT ---
// =============================================================
const StudentSelector = memo(({ classId, onChange, onLoadingChange, initialSelectedStudents = [], unavailableStudentIds = [] }) => {
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState(initialSelectedStudents); 
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");

    // 1. DEDICATED EFFECT FOR STATE SYNCHRONIZATION
    useEffect(() => {
        setSelectedStudents(initialSelectedStudents);
        onChange(initialSelectedStudents); 
    }, [initialSelectedStudents, onChange]);

    // 2. MEMOIZED FUNCTION FOR FETCHING THE FULL STUDENT LIST
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
                `${CLASSROOM_SERVICE_URL}/classrooms/${classId}/student-roster-ids`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const studentIds = idResponse.data.studentIds;
            if (studentIds.length === 0) {
                setStudents([]);
                return;
            }
            // STEP 2: Get full student details from the User Service using batch lookup
            const idsQuery = studentIds.join(',');
            const usersResponse = await axios.get(
                `${USER_SERVICE_SERVICE_URL}/users/batch?ids=${idsQuery}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const studentDetails = usersResponse.data.map(user => ({
                _id: user._id,
                name: user.name,
            }));
            setStudents(studentDetails);

        } catch (err) {
            console.error("Error fetching students for selector:", err.response?.data || err.message);
            setStudents([]);
            onChange([]);
        } finally {
            setLoading(false);
            onLoadingChange(false);
        }
    }, [classId, token, onLoadingChange]); 

    // 3. EFFECT TO TRIGGER FETCHING
    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]); 

    const handleToggleSelect = (id) => {
        const isSelected = selectedStudents.includes(id);
        const newSelected = isSelected
            ? selectedStudents.filter(studentId => studentId !== id)
            : [...selectedStudents, id];
        
        setSelectedStudents(newSelected);
        onChange(newSelected); // Pass array of IDs back to parent
    };
    
    // Determine which students to show (selected OR not unavailable)
    const studentListToShow = students.filter(s => 
        selectedStudents.includes(s._id) || 
        !unavailableStudentIds.includes(s._id)
    );

    return (
        <div className="form-group">
            <label>Assign to Students:</label>
            {loading ? (
                <p style={{ color: 'gray' }}>Loading students...</p>
            ) : students.length === 0 ? (
                <p style={{ color: 'red' }}>No students found in this class (or an API error occurred).</p>
            ) : (
                <div className="custom-select-list">
                    {studentListToShow.map(s => { 
                        const isSelected = selectedStudents.includes(s._id);
                        return (
                            <div
                                key={s._id}
                                className={`custom-list-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleToggleSelect(s._id)}
                            >
                                {s.name}
                                {!isSelected && unavailableStudentIds.includes(s._id) && (
                                    <span style={{color: 'red', marginLeft: '10px', fontSize: '0.8em'}}>
                                        (Assigned to another group)
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <small>
                {selectedStudents.length} student(s) selected. 
                {studentListToShow.length < students.length && (
                    <span style={{color: '#5d4291', marginLeft: '10px'}}>
                        ({students.length - studentListToShow.length} student(s) hidden, already assigned to other groups.)
                    </span>
                )}
            </small>
        </div>
    );
}); 

// =============================================================
//                       --- MAIN GROUP SERVICE COMPONENT ---
// =============================================================
const GroupService = () => {
    const { id: classId } = useParams(); 
    const [groups, setGroups] = useState([]);
    const [members, setMembers] = useState([]); 
    const [allMembers, setAllMembers] = useState([]); 
    const [searchTerm, setSearchTerm] = useState("");
    const [studentNameMap, setStudentNameMap] = useState({}); 
    
    // Popups
    const [showCreatePopup, setShowCreatePopup] = useState(false);
    const [showContributionPopup, setShowContributionPopup] = useState(false); 
    const [showAllMembersPopup, setShowAllMembersPopup] = useState(false); 
    const [showUpdatePopup, setShowUpdatePopup] = useState(false); 

    const [isStudentSelectorLoading, setIsStudentSelectorLoading] = useState(false);
    
    // States for Group Creation/Update
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedStudents, setAssignedStudents] = useState([]); 
    const [file, setFile] = useState(null); 
    
    // Local messages for popups
    const [msg, setMsg] = useState("");
    const [gradingMsg, setGradingMsg] = useState("");
    const [uploading, setUploading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [groupTarget, setGroupTarget] = useState(null); 
    
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const dropdownRef = useRef(null);
    const token = localStorage.getItem("token");
    const userRef = useRef(JSON.parse(localStorage.getItem("user")));
    const user = userRef.current;

    const isTeacher = user?.role === "teacher";
    const userId = user?._id;
    const navigate = useNavigate();
    const BASE_URL = GROUP_SERVICE_URL;

    // --- Data Fetching Functions (Memoized) ---
    const fetchGroups = useCallback(async () => {
        try {
            const res = await axios.get(
                `${BASE_URL}/groups/class/${classId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setGroups(res.data || []);
            return res.data.map(g => g._id);
        } catch (err) {
            console.error("Error fetching groups:", err);
            return [];
        }
    }, [classId, token]);

    const fetchAllMembers = useCallback(async (groupIds) => {
        if (groupIds.length === 0) {
            setAllMembers([]);
            return;
        }
        try {
            const fetchPromises = groupIds.map(gId =>
                axios.get(`${BASE_URL}/group-members/${gId}`, { headers: { Authorization: `Bearer ${token}` } }) 
            );
            const responses = await Promise.all(fetchPromises);
            const combinedMembers = responses.flatMap(res => res.data || []);
            setAllMembers(combinedMembers);
        } catch (err) {
            console.error("Error fetching all members:", err);
            setAllMembers([]);
        }
    }, [token, BASE_URL]);
    
    const fetchMembers = async (groupId, setList) => {
        try {
            const res = await axios.get(
                `${BASE_URL}/group-members/${groupId}`, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setList(res.data || []);
        } catch (err) {
            console.error("Error fetching members:", err);
        }
    };
    
    // Main useEffect to load data
    useEffect(() => {
        if (!user || !token) {
            navigate("/option");
            return;
        }
        const loadData = async () => {
            const ids = await fetchGroups(); 
            if (ids.length > 0) {
                await fetchAllMembers(ids);
            }
        };

        loadData();
    }, [classId, token, user, navigate, fetchGroups, fetchAllMembers]);

    // Fetch student names (Teacher view)
    useEffect(() => {
    const fetchStudentNames = async () => {
        if (!classId || !token) return; 
        try {
            // --- THIS LINE MUST BE CORRECTED ---
            const idResponse = await axios.get(
                `${CLASSROOM_SERVICE_URL}/classrooms/${classId}/student-roster-ids`, // <--- CORRECTED ROUTE
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // ------------------------------------
            
            const studentIds = idResponse.data.studentIds;
            if (studentIds.length === 0) return;
            
            const idsQuery = studentIds.join(',');
            const usersResponse = await axios.get(
                `${USER_SERVICE_SERVICE_URL}/users/batch?ids=${idsQuery}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
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
}, [classId, token]);

    // Handle outside click for dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- File Download Logic ---
    const getSignedUrl = async (type, fileOwnerId) => {
        try {
            let endpoint;
            if (type === "group") {
                endpoint = `${BASE_URL}/groups/${fileOwnerId}/file`; 
            } else if (type === "contribution") {
                endpoint = `${BASE_URL}/group-members/file/${fileOwnerId}`; 
            } else {
                throw new Error("Invalid file type.");
            }
            
            const res = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (!res.data || !res.data.url) {
                throw new Error("Missing URL in signed URL response. Backend issue.");
            }
            return { url: res.data.url, fileName: res.data.fileName };
        } catch (err) {
            console.error("Failed to get signed URL:", err.response?.data || err.message);
            return null;
        }
    };
    
    const handleDownload = async (id, fileName, type) => {
        setMsg(""); 
        let fileOwnerId;
        if (type === 'contribution') {
            fileOwnerId = id; 
        } else if (type === 'group') {
            fileOwnerId = id; 
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
            link.setAttribute('download', result.fileName || fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => setMsg(""), 3000);
        } else {
            setMsg(`   ❌ Failed to get download link for file: ${fileName}.`);
        }
    };
    
    // --- Teacher Group Actions ---
    const handleDeleteGroup = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(
                `${BASE_URL}/groups/${deleteTarget._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const ids = await fetchGroups();
            await fetchAllMembers(ids);
            setDeleteTarget(null);
            setMsg("Group and all related contributions deleted successfully.");
        } catch (err) {
            console.error("Delete failed:", err);
            setMsg("Failed to delete group.");
        }
    };

    const handleCreateGroup = async () => {
        if (!title) {
            setMsg("Please provide a title.");
            return;
        }
        if (isStudentSelectorLoading) {
            setMsg("Please wait for student data to load.");
            return;
        }
        if (assignedStudents.length === 0) {
            setMsg("Please select at least one student to assign to the group.");
            return;
        }
        
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("title", title);
            formData.append("description", description);
            
            formData.append("assignedStudents", JSON.stringify(assignedStudents)); 

            if (file) {
                formData.append("file", file);
            }
            
            formData.append("classId", classId);

            await axios.post(
                `${BASE_URL}/groups`,
                formData,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setMsg("Group created successfully!");
            // Clear form
            setTitle("");
            setDescription("");
            setFile(null);
            setAssignedStudents([]);

            const ids = await fetchGroups();
            await fetchAllMembers(ids);

            setTimeout(() => setShowCreatePopup(false), 2000);
        } catch (err) {
            console.error("Creation failed. Backend response details:", err.response?.data);
            console.error("Status:", err.response?.status);

            setMsg("Creation failed. Ensure all fields are valid.");
        } finally {
            setUploading(false);
        }
    };
    
    const handleUpdateGroup = async () => {
        if (!groupTarget || !title) {
            setMsg("Missing group details.");
            return;
        }
        if (isStudentSelectorLoading) {
            setMsg("Please wait for student data to load.");
            return;
        }
        if (assignedStudents.length === 0) {
             setMsg("A group must be assigned to at least one student.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("title", title); 
            formData.append("description", description);
            
            if (file) {
                formData.append("file", file);
            }
            formData.append("assignedStudents", JSON.stringify(assignedStudents)); 

            await axios.put(
                `${BASE_URL}/groups/${groupTarget._id}`,
                formData,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setMsg("Group updated successfully!");
            setGroupTarget(null);
            setTitle("");
            setDescription("");
            setFile(null);
            setAssignedStudents([]);

            const ids = await fetchGroups();
            await fetchAllMembers(ids);

            setTimeout(() => setShowUpdatePopup(false), 2000);
        } catch (err) {
            console.error("Update failed:", err);
            setMsg(`Update failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setUploading(false);
        }
    }
    
    const handleOpenUpdate = (group) => {
        setGroupTarget(group);
        setTitle(group.title);
        setDescription(group.description);
        setAssignedStudents(group.assignedStudents || []); 
        setFile(null); 
        setMsg("");
        setShowUpdatePopup(true);
    }
    
    // --- Student Contribution Actions (Synchronization Trigger) ---
    const handleUploadContribution = async () => {
        if (!file || !groupTarget) return;
        
        const existingMember = members.find(m => m.studentId === userId && m.groupId === groupTarget._id);

        if (existingMember && existingMember.status === 'graded') {
            setMsg("Contribution is already graded and cannot be modified.");
            return;
        }
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);
            formData.append("groupId", groupTarget._id); 
            
            // NOTE: The backend MUST update ALL group members (if not graded)
            await axios.post(`${BASE_URL}/group-members/upload`, formData, {
                headers: { Authorization: `Bearer ${token}` }, 
            });
            
            setMsg("Contribution submitted successfully! (Replacing previous file if one existed)");
            setFile(null);
            
            // CRITICAL STEP: Re-fetch data to reflect the synchronized submission status for all members
            fetchMembers(groupTarget._id, setMembers); // Updates members in the current popup
            const groupIds = groups.map(g => g._id);
            fetchAllMembers(groupIds); // Updates status on the main dashboard group cards
            
            setTimeout(() => setMsg(""), 3000);
        } catch (err) {
            console.error("Submission failed:", err);
            const errorMsg = err.response?.data?.error || "Submission failed. Check console for details.";
            setMsg(`   ❌   ${errorMsg}`);
        } finally {
            setUploading(false);
        }
    };
    
    // --- Teacher Grading Action ---
    const handleGradeContribution = async (member) => {
        const marksValue = member.marks === "" || member.marks === null ? null : Number(member.marks);

        if (marksValue !== null && (isNaN(marksValue) || marksValue < 0 || marksValue > 100)) {
            setGradingMsg("Marks must be between 0 and 100.");
            return;
        }
        try {
            await axios.put(
                `${BASE_URL}/group-members/grade/${member._id}`,
                {
                    marks: marksValue, 
                    feedback: member.feedback
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setGradingMsg("Graded successfully!");
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

    const filteredGroups = groups
        .filter((g) => 
            (g.title || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        
    const handleStudentChange = useCallback((students) => {
        setAssignedStudents(students);
    }, []); 

    const handleLoadingChange = useCallback((isLoading) => {
        setIsStudentSelectorLoading(isLoading);
    }, []); 
    
    // Calculate unavailable students for Creation and Update
    const allAssignedStudents = groups.flatMap(g => g.assignedStudents);
    const unavailableForCreation = [...new Set(allAssignedStudents)];

    const unavailableForUpdate = groupTarget
        ? groups
            .filter(g => g._id !== groupTarget._id) 
            .flatMap(g => g.assignedStudents)
        : []; 

    const uniqueUnavailableForUpdate = [...new Set(unavailableForUpdate)];

    // =================================================================

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
                    <h1>Groups</h1>
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
                    <button onClick={() => { navigate(`/classroom/${classId}`); setSidebarOpen(false);}}>Folders</button>
                    <button>Meeting</button>
                </aside>
                <main className={sidebarOpen ? "shifted" : ""}>
                    <div className="assignments-page">
                        <div className="controls">
                            <input
                                type="text"
                                placeholder="Search groups..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {isTeacher && (
                                <button onClick={() => {
                                    setShowCreatePopup(true);
                                    setMsg(""); 
                                    setTitle("");
                                    setDescription("");
                                    setFile(null);
                                    setAssignedStudents([]); 
                                }}>
                                    + Create Group Work
                                </button>
                            )}
                        </div>
                       <div className="assignments-list">
    {filteredGroups.map((group) => {
        const member = allMembers.find(
            (m) => m.studentId === userId && m.groupId === group._id
        );
        const isAssigned = group.assignedStudents.includes(userId);

        // --- CORRECTLY GENERATES COMMA-SEPARATED LIST OF NAMES ---
        const assignedDisplay = group.assignedStudents
            .map(id => studentNameMap[id])
            .filter(name => name)
            .join(', ');
        // ----------------------------------------------------------

        if (isTeacher || isAssigned) {
            return (
                <div key={group._id} className="assignment-card">
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                    
                    {/* --- STUDENT NAMES DISPLAYED FOR ALL ASSIGNED USERS (STUDENT OR TEACHER) --- */}
                    <div className="status-label">
                        {assignedDisplay && (
                            <p >
                            Group Members: <span>{assignedDisplay}</span>
                            </p>
                        )}
                        
                        {/* Display Status based on role */}
                        {isTeacher 
                            ? `Assigned: ${group.assignedStudents.length} students`
                            : member?.status === 'graded' 
                                ? `Grade: ${member.marks !== null ? member.marks : 'N/A'}`
                                : member?.status === 'submitted' 
                                    ? 'Status: Submitted'
                                    : 'Status: Assigned'
                        }
                    </div>
                    {/* ------------------------------------------------------------------------- */}

                    <div className="actions">
                        {group.fileId && (
                            <button onClick={() => handleDownload(group._id, group.originalName, 'group')}>
                                Question
                            </button>
                        )}
                        {isTeacher ? (
                            <>
                                <button
                                    className="secondary"
                                    onClick={() => handleOpenUpdate(group)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="danger"
                                    onClick={() => setDeleteTarget(group)}
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => {
                                        setGroupTarget(group);
                                        const membersForGroup = allMembers.filter(m => m.groupId === group._id);
                                        setMembers(membersForGroup); 
                                        setShowAllMembersPopup(true);
                                        setGradingMsg("");
                                    }}
                                >
                                    View Contributions
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => {
                                    setGroupTarget(group);
                                    fetchMembers(group._id, setMembers); 
                                    setShowContributionPopup(true);
                                    setMsg("");
                                }}
                            >
                                {member?.status === 'graded' ? "View Grade" : "Submit/Edit"}
                            </button>
                        )}
                    </div>
                </div>
            );
        } 
        return null;
    })}
    {filteredGroups.filter(g => isTeacher || g.assignedStudents.includes(userId)).length === 0 && (
        <p style={{ textAlign: 'center', marginTop: '50px', color: 'gray' }}>
            {isTeacher ? "No groups created yet." : "You have not been assigned to any groups."}
        </p>
    )}
</div>
                    </div>

                    {/* --- POPUP 1: TEACHER CREATE GROUP --- */}
                    {showCreatePopup && (
                        <div className="popup">
                            <div className="popup-content">
                                <div className="popup-header">
                                    <h3>Create New Group</h3>
                                    <button className="close-btn" onClick={() => { setShowCreatePopup(false); setMsg(""); }}>×</button>
                                </div>
                                {msg && <p className="popup-msg" style={{ color: msg.startsWith('   ❌') ? 'red' : 'green' }}>{msg}</p>}

                                <div className="form-group">
                                    <label>Group Title</label>
                                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Description (Optional)</label>
                                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Group File (Document/Resource) - Optional</label>
                                    <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                                    <small>{file?.name || "No file selected."}</small>
                                </div>

                                <StudentSelector
                                    classId={classId}
                                    onChange={handleStudentChange} 
                                    onLoadingChange={handleLoadingChange}
                                    initialSelectedStudents={assignedStudents} 
                                    unavailableStudentIds={unavailableForCreation} 
                                />

                                <div className="popup-actions">
                                    <button onClick={handleCreateGroup} disabled={uploading || isStudentSelectorLoading}>
                                        {uploading ? "Creating..." : "Create Group work"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* --- POPUP 2: TEACHER UPDATE GROUP --- */}
                    {showUpdatePopup && groupTarget && (
                        <div className="popup">
                            <div className="popup-content">
                                <div className="popup-header">
                                    <h3>Update Group: {groupTarget.title}</h3>
                                    <button className="close-btn" onClick={() => { 
                                        setShowUpdatePopup(false); 
                                        setMsg(""); 
                                        setGroupTarget(null);
                                    }}>×</button>
                                </div>
                                {msg && <p className="popup-msg" style={{ color: msg.startsWith('   ❌') ? 'red' : 'green' }}>{msg}</p>}

                                <div className="form-group">
                                    <label>Group Title</label>
                                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Description (Optional)</label>
                                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Update Group File (Optional)</label>
                                    <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                                    <small>
                                        Current file: {groupTarget.originalName || "None"}. 
                                        {file ? `New file selected: ${file.name}` : ' Uploading a new file will replace the current one.'}
                                    </small>
                                </div>

                                <StudentSelector
                                    classId={classId}
                                    onChange={handleStudentChange}
                                    onLoadingChange={handleLoadingChange}
                                    initialSelectedStudents={groupTarget.assignedStudents}
                                    unavailableStudentIds={uniqueUnavailableForUpdate}
                                />

                                <div className="popup-actions">
                                    <button onClick={handleUpdateGroup} disabled={uploading || isStudentSelectorLoading}>
                                        {uploading ? "Updating..." : "Save Changes"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- POPUP 3: STUDENT SUBMIT/VIEW CONTRIBUTION --- */}
                    {showContributionPopup && groupTarget && (
                        <div className="popup">
                            <div className="popup-content">
                                <div className="popup-header">
                                    <h3>{groupTarget.title} Contribution</h3>
                                    <button className="close-btn" onClick={() => { setShowContributionPopup(false); setMsg(""); setFile(null);}}>×</button>
                                </div>
                                {msg && <p className="popup-msg" style={{ color: msg.startsWith('   ❌') ? 'red' : 'green' }}>{msg}</p>}

                                {groupTarget.fileId && (
                                    <div style={{ marginBottom: '20px', marginTop: '20px' ,color: '#5a43aa'}}>
                                        <h4>Group File: {groupTarget.originalName}</h4>
                                        <button style={{ marginBottom: '20px', marginTop: '20px'}} className="secondary" onClick={() => handleDownload(groupTarget._id, groupTarget.originalName, 'group')}>
                                            Download Question
                                        </button>
                                    </div>
                                )}

                                {(() => {
                                    const studentMember = members.find(m => m.studentId === userId);
                                    const isGraded = studentMember?.status === 'graded';

                                    if (isGraded) {
                                        return (
                                            <div className="grade-view">
                                                <h4>Your Grade: <span style={{ color: 'green', fontWeight: 'bold' }}>{studentMember.marks !== null ? studentMember.marks : 'N/A'}</span></h4>
                                                <p><strong>Feedback:</strong> {studentMember.feedback || 'No feedback provided.'}</p>
                                                {studentMember.fileId && (
                                                    <button className="action-btn" onClick={() => handleDownload(studentMember._id, studentMember.originalName, 'contribution')}>
                                                        Download Your Submitted File
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <>
                                                <h4>Upload Your Contribution File:</h4>
                                                <div className="form-group">
                                                    <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                                                    <small>
                                                        Current file: {studentMember?.originalName || "None"}.
                                                        {file ? `New file selected: ${file.name}` : ' Uploading a new file will replace the current one.'}
                                                    </small>
                                                </div>
                                                
                                                <div className="popup-actions">
                                                    <button onClick={handleUploadContribution} disabled={uploading || !file}>
                                                        {uploading ? "Submitting..." : (studentMember?.fileId ? "Update Contribution" : "Submit Contribution")}
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    )}

                    {/* --- POPUP 4: TEACHER VIEW ALL CONTRIBUTIONS --- */}
                    {showAllMembersPopup && groupTarget && (
                        <div className="popup large-popup">
                            <div className="popup-content">
                                <div className="popup-header">
                                    <h3>Contributions for: {groupTarget.title}</h3>
                                    <button className="close-btn" onClick={() => { setShowAllMembersPopup(false); setGradingMsg(""); }}>×</button>
                                </div>
                                {gradingMsg && <p className="popup-msg" style={{ color: gradingMsg.startsWith('Graded successfully') ? 'green' : 'red' }}>{gradingMsg}</p>}

                                <div className="submission-list">
                                    {members.length === 0 ? (
                                        <p>No member records exist for this group yet (even those that haven't submitted a file).</p>
                                    ) : (
                                        members.map((member) => (
                                            <MemberCard 
                                                key={member._id} 
                                                member={member} 
                                                studentNameMap={studentNameMap} 
                                                handleDownload={handleDownload} 
                                                handleGradeContribution={handleGradeContribution} 
                                                setAllMembers={setAllMembers} 
                                                allMembers={allMembers} 
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- POPUP 5: TEACHER DELETE CONFIRMATION --- */}
                    {deleteTarget && (
                        <div className="popup">
                            <div className="popup-content">
                                <div className="popup-header">
                                    <h3>Confirm Deletion</h3>
                                    <button className="close-btn" onClick={() => setDeleteTarget(null)}>×</button>
                                </div>
                                <p>Are you sure you want to delete group: <strong>{deleteTarget.title}</strong>? This action will also delete all student contributions for this group, including their files.</p>
                                <div className="popup-actions">
                                    <button className="secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                                    <button className="danger" onClick={handleDeleteGroup}>Delete Group</button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default GroupService;


// =============================================================
//                       --- MEMBER CARD COMPONENT ---
// =============================================================

const MemberCard = ({ member, studentNameMap, handleDownload, handleGradeContribution, setAllMembers, allMembers }) => {
    const [marks, setMarks] = useState(member.marks !== null ? member.marks : '');
    const [feedback, setFeedback] = useState(member.feedback || '');
    const studentName = studentNameMap[member.studentId] || 'Unknown Student';

    useEffect(() => {
        setMarks(member.marks !== null ? member.marks : '');
        setFeedback(member.feedback || '');
    }, [member]);

    const handleGradeSave = () => {
        const updatedMember = {
            ...member,
            marks: marks === '' ? null : Number(marks),
            feedback: feedback
        };
        handleGradeContribution(updatedMember);
        setAllMembers(prev => prev.map(m => m._id === member._id ? updatedMember : m));
    };

    const handleMarksChange = (e) => {
        if (e.target.value === '') {
            setMarks('');
        } else {
            const value = e.target.value;
            if (/^\d*$/.test(value) && (value === '' || (Number(value) >= 0 && Number(value) <= 100))) {
                setMarks(value);
            }
        }
    };

    const handleFeedbackChange = (e) => {
        setFeedback(e.target.value);
    };

    return (
        <div className={`submission-card ${member.status}`}>
            <div className="submission-header">
                <h4>{studentName}</h4>
                <span className={`status-tag ${member.status}`}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                </span>
            </div>
            
            <p className="file-info">File: {member.originalName || 'No file uploaded'}</p>

            <div className="grade-section">
                <div className="grade-input">
                    <label>Marks (0-100)</label>
                    <input 
                        type="number" 
                        value={marks} 
                        onChange={handleMarksChange} 
                        min="0" 
                        max="100" 
                    />
                </div>
                <div className="feedback-input">
                    <label>Feedback</label>
                    <textarea 
                        value={feedback} 
                        onChange={handleFeedbackChange} 
                    />
                </div>
            </div>

            <div className="submission-actions">
                {member.fileId && (
                    <button onClick={() => handleDownload(member._id, member.originalName, 'contribution')}>
                        Download File
                    </button>
                )}
                <button className="save-grade" onClick={handleGradeSave} style={{ marginTop: '10px' ,backgroundColor: '#5a43aa', marginBottom: '10px'}}>
                    Save Grade
                </button>
            </div>
            {member.gradedAt && <small className="graded-info">Graded on: {new Date(member.gradedAt).toLocaleDateString()}</small>}
        </div>
    );
}