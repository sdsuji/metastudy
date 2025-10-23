import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginRegisterOption.css';

const LoginRegisterOption = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.email) emailRef.current.focus();
      else if (newErrors.password) passwordRef.current.focus();
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.msg || data.error || 'Login failed');

     localStorage.setItem('token', data.token);
     
localStorage.setItem('user', JSON.stringify(data.user));

setMessage('Login successful! Redirecting...');
setMessageType('success');

const role = data.user?.role;

setTimeout(() => {
  if (role === 'teacher' || role === 'student') {
    navigate('/dashboard');
  } else {
    navigate('/'); // Fallback route
  }
}, 1000);
    } catch (err) {
      setMessage(err.message);
      setMessageType('error');
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    }
  };

  return (
    <div className="form-container">
      <form className="form-box align-right" onSubmit={handleSubmit}>
        <h2>Login</h2>

        <input
          ref={emailRef}
          name="email"
          type="email"
          placeholder={errors.email || 'Email'}
          value={formData.email}
          onChange={handleChange}
          className={errors.email ? 'input-error' : ''}
        />

        <input
          ref={passwordRef}
          name="password"
          type="password"
          placeholder={errors.password || 'Password'}
          value={formData.password}
          onChange={handleChange}
          className={errors.password ? 'input-error' : ''}
        />

        <button type="submit">Login</button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate('/register')}
        >
          Don't have an account? Register.
        </button>
        <p className="forgot-link" onClick={() => navigate('/forgot-password')}>
  Forgot Password?
</p>


        {message && (
          <div className={`form-message ${messageType}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
};

export default LoginRegisterOption;
