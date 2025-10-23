import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard/Dashboard.css';
import './ClassroomDetail.css';
import './DiscussionPage.css';

const DiscussionPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [discussions, setDiscussions] = useState([]);
    const [newPost, setNewPost] = useState('');
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingPostContent, setEditingPostContent] = useState('');
    const [commentInputs, setCommentInputs] = useState({});
    const [editCommentInputs, setEditCommentInputs] = useState({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [confirmDeletePostId, setConfirmDeletePostId] = useState(null);
    const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState({});
    const dropdownRef = useRef(null);

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const isTeacher = user?.role === 'teacher';

    useEffect(() => {
        window.history.pushState(null, '', window.location.href);
        const onPop = () => window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const showStatus = (msg, isError = false) => {
        if (isError) setError(msg);
        else setSuccess(msg);
        setTimeout(() => {
            setError('');
            setSuccess('');
        }, 3000);
    };

    const fetchDiscussions = () => {
        setLoading(true);
        axios
            .get(`http://localhost:5003/api/discussions/class/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then(res => setDiscussions(res.data.discussions))
            .catch(() => showStatus('Failed to load discussions.', true))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchDiscussions();
    }, [id]);

    useEffect(() => {
        const handleClick = e => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/option');
    };

    const postWrapper = () => {
        if (!newPost.trim()) return;
        axios
            .post('http://localhost:5003/api/discussions', { content: newPost, classId: id }, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setNewPost('');
                fetchDiscussions();
                showStatus('Post added.');
            })
            .catch(() => showStatus('Failed to post.', true));
    };

    const deletePost = postId => {
        axios
            .delete(`http://localhost:5003/api/discussions/${postId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setConfirmDeletePostId(null);
                fetchDiscussions();
                showStatus('Post deleted.');
            })
            .catch(() => showStatus('Failed to delete post.', true));
    };

    const editWrapper = postId => {
        axios
            .put(`http://localhost:5003/api/discussions/${postId}`, { content: editingPostContent }, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setEditingPostId(null);
                setEditingPostContent('');
                fetchDiscussions();
                showStatus('Post updated.');
            })
            .catch(() => showStatus('Failed to edit post.', true));
    };

    const addComment = discussionId => {
        const content = commentInputs[discussionId]?.trim();
        if (!content) return;
        axios
            .post(`http://localhost:5003/api/discussions/${discussionId}/comments`, { content }, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setCommentInputs(prev => ({ ...prev, [discussionId]: '' }));
                fetchDiscussions();
                showStatus('Comment added.');
            })
            .catch(() => showStatus('Failed to add comment.', true));
    };

    const deleteComment = (discussionId, commentId) => {
        axios
            .delete(`http://localhost:5003/api/discussions/${discussionId}/comments/${commentId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setConfirmDeleteCommentId(prev => ({ ...prev, [commentId]: false }));
                fetchDiscussions();
                showStatus('Comment deleted.');
            })
            .catch(() => showStatus('Failed to delete comment.', true));
    };

    const editComment = (discussionId, commentId) => {
        const content = editCommentInputs[commentId]?.trim();
        if (!content) return;
        axios
            .put(`http://localhost:5003/api/discussions/${discussionId}/comments/${commentId}`, { content }, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setEditCommentInputs(prev => {
                    const updated = { ...prev };
                    delete updated[commentId];
                    return updated;
                });
                fetchDiscussions();
                showStatus('Comment updated.');
            })
            .catch(() => showStatus('Failed to edit comment.', true));
    };

    return (
        <>
            <header>
                <div className="left-header">
                    <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
                    <h1>Discussion Forum</h1>
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
                    <button onClick={() => navigate("/dashboard")}>Home</button>
                    <button onClick={() => { navigate(`/classroom/${id}`); setSidebarOpen(false);}}>Folders</button> 
                    <button>Meeting</button>
                </aside>

                <main className={sidebarOpen ? 'shifted' : ''}>
                    <div className="discussion-page">
                        <div className="discussion-welcome">
                            <h2>Welcome to the Discussion Forum</h2>
                            <p>Ask questions, share insights, and collaborate with your classmates here.</p>
                        </div>

                        <div className="discussion-form">
                            <textarea
                                value={newPost}
                                onChange={e => setNewPost(e.target.value)}
                                placeholder="Type your message..."
                            />
                            <button onClick={postWrapper}>Post</button>
                            {error && <p className="error-msg">{error}</p>}
                            {success && <p className="success-msg">{success}</p>}
                        </div>

                        {loading ? (
                            <p>Loading...</p>
                        ) : discussions.length === 0 ? (
                            <p style={{color: '#5a43aa'}}>No discussions yet. Start a conversation!</p>
                        ) : (
                            discussions.map(post => (
                                <div key={post._id} className="discussion-post">
                                    <div className="post-header">
                                        <strong>{post.authorName}</strong>
                                        <span className="timestamp">{new Date(post.postedAt).toLocaleString()}</span>
                                    </div>

                                    <div className="post-content-and-actions">
                                        {editingPostId === post._id ? (
                                            <div className="edit-container fade-slide-in">
                                                <textarea
                                                    value={editingPostContent}
                                                    onChange={e => setEditingPostContent(e.target.value)}
                                                    rows={4}
                                                />
                                                <div className="edit-buttons">
                                                    <button onClick={() => editWrapper(post._id)}>Save</button>
                                                    <button onClick={() => setEditingPostId(null)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p>{post.content}</p>
                                        )}

                                        {/* POST CONTROLS VISIBILITY: String() added here for reliable comparison */}
                                        {(String(post.author) === user._id || isTeacher) && (
                                            <div className="post-controls">
                                                {/* EDIT BUTTON VISIBILITY: String() added here for reliable comparison */}
                                                {String(post.author) === user._id && (
                                                    <button onClick={() => {
                                                        setEditingPostId(post._id);
                                                        setEditingPostContent(post.content);
                                                    }}>Edit</button>
                                                )}
                                                {confirmDeletePostId === post._id ? (
                                                    <div className="confirmation-box">
                                                        <span>Are you sure?</span>
                                                        <button onClick={() => deletePost(post._id)}>Yes</button>
                                                        <button className="cancel-btn" onClick={() => setConfirmDeletePostId(null)}>No</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setConfirmDeletePostId(post._id)}>Delete</button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="comments-section">
                                        <h5 style={{ color: '#5a43aa'}}>Comments</h5>
                                        {post.comments?.map(comment => (
                                            <div key={comment._id} className="comment">
                                                <strong>{comment.authorName}</strong>
                                                <span className="timestamp">{new Date(comment.postedAt).toLocaleString()}</span>

                                                {/* Wrap content and controls for better layout */}
                                                {editCommentInputs[comment._id] !== undefined ? (
                                                    <div className="edit-container fade-slide-in">
                                                         <textarea
                                                            value={editCommentInputs[comment._id] || ''}
                                                            onChange={e => setEditCommentInputs(prev => ({ ...prev, [comment._id]: e.target.value }))}
                                                            rows={3}
                                                        />
                                                        <div className="edit-buttons">
                                                            <button onClick={() => editComment(post._id, comment._id)}>Save</button>
                                                            <button onClick={() => setEditCommentInputs(prev => { const updated = { ...prev }; delete updated[comment._id]; return updated; })}>Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="comment-text-and-actions">
                                                        <p>{comment.content}</p>
                                                        {/* COMMENT CONTROLS VISIBILITY: String() added here for reliable comparison */}
                                                        {(String(comment.author) === user._id || isTeacher) && (
                                                            <div className="comment-controls">
                                                                {/* EDIT COMMENT BUTTON VISIBILITY: String() added here for reliable comparison */}
                                                                {String(comment.author) === user._id && (
                                                                    <button onClick={() =>
                                                                        setEditCommentInputs(prev => ({ ...prev, [comment._id]: comment.content }))
                                                                    }>Edit</button>
                                                                )}
                                                                {confirmDeleteCommentId[comment._id] ? (
                                                                    <div className="confirmation-box">
                                                                        <span>Are you sure?</span>
                                                                        <button onClick={() => deleteComment(post._id, comment._id)}>Yes</button>
                                                                        <button className="cancel-btn" onClick={() =>
                                                                            setConfirmDeleteCommentId(prev => ({ ...prev, [comment._id]: false }))
                                                                        }>No</button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() =>
                                                                        setConfirmDeleteCommentId(prev => ({ ...prev, [comment._id]: true }))
                                                                    }>Delete</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        <div className="comment-form">
                                            <input
                                                type="text"
                                                placeholder="Add a comment..."
                                                value={commentInputs[post._id] || ''}
                                                onChange={e =>
                                                    setCommentInputs(prev => ({ ...prev, [post._id]: e.target.value }))
                                                }
                                            />
                                            <button onClick={() => addComment(post._id)}>Add</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
        </>
    );
};

export default DiscussionPage;