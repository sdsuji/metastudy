import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Form.css';
import axios from 'axios';

const UnifiedRegister = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    staffId: '',
    gender: '',
    email: '',
    department: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const inputRefs = {
    name: useRef(null),
    rollNo: useRef(null),
    staffId: useRef(null),
    gender: useRef(null),
    email: useRef(null),
    department: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
  };

  useEffect(() => {
    const handleBack = e => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
    setMessage('');
    setMessageType('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const newErrors = {};
    setMessage('');
    setMessageType('');

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else {
      const emailRegex = /^[\w.-]+@[\w.-]+\.(com|in)$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Email must end with .com or .in';
      }
    }

    if (!formData.department.trim()) newErrors.department = 'Department is required';

    if (role === 'student') {
      if (!formData.rollNo.trim()) newErrors.rollNo = 'Roll Number is required';
      if (!formData.gender.trim()) newErrors.gender = 'Gender is required';
    } else {
      if (!formData.staffId.trim()) newErrors.staffId = 'Staff ID is required';
      else if (!/^[a-zA-Z0-9]+$/.test(formData.staffId.trim())) {
        newErrors.staffId = 'Staff ID must be alphanumeric only';
      }
    }

    if (!formData.password) newErrors.password = 'Password is required';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(formData.password)) {
      newErrors.password = 'Password must be strong (min 8 chars, upper, lower, digit, symbol)';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.keys(newErrors)[0];
      inputRefs[firstError]?.current?.focus();
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role,
        department: formData.department,
        ...(role === 'student'
          ? { rollNo: formData.rollNo, gender: formData.gender }
          : { staffId: formData.staffId }),
      };

      await axios.post('http://localhost:5000/api/users/register', payload);

      setMessage('Registered successfully! Please check your email to verify your account.');
      setMessageType('success');
      setTimeout(() => navigate('/option'), 3000);
    } catch (error) {
      const errMsg =
        error.response?.data?.msg ||
        error.response?.data?.error ||
        'Registration failed';
      setMessage(errMsg);
      setMessageType('error');
    }
  };

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={handleSubmit}>
        <select name="role" value={role} onChange={e => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Instructor</option>
        </select>

        <div className="input-group">
          <input
            ref={inputRefs.name}
            name="name"
            value={formData.name}
            placeholder="Name"
            className={errors.name ? 'input-error' : ''}
            onChange={handleChange}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="input-group">
          <input
            ref={inputRefs.email}
            name="email"
            type="email"
            value={formData.email}
            placeholder="Email"
            className={errors.email ? 'input-error' : ''}
            onChange={handleChange}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="input-group">
          <input
            ref={inputRefs.department}
            name="department"
            value={formData.department}
            placeholder="Department"
            className={errors.department ? 'input-error' : ''}
            onChange={handleChange}
          />
          {errors.department && <span className="error-text">{errors.department}</span>}
        </div>

        {role === 'student' && (
          <>
            <div className="input-group">
              <input
                ref={inputRefs.rollNo}
                name="rollNo"
                value={formData.rollNo}
                placeholder="Roll Number"
                className={errors.rollNo ? 'input-error' : ''}
                onChange={handleChange}
              />
              {errors.rollNo && <span className="error-text">{errors.rollNo}</span>}
            </div>

            <div className="input-group">
              <select
                ref={inputRefs.gender}
                name="gender"
                value={formData.gender}
                className={errors.gender ? 'input-error' : ''}
                onChange={handleChange}
              >
                <option value="" disabled>
                  -- Select Gender --
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.gender && <span className="error-text">{errors.gender}</span>}
            </div>
          </>
        )}

        {role === 'teacher' && (
          <div className="input-group">
            <input
              ref={inputRefs.staffId}
              name="staffId"
              value={formData.staffId}
              placeholder="Staff ID"
              className={errors.staffId ? 'input-error' : ''}
              onChange={handleChange}
            />
            {errors.staffId && <span className="error-text">{errors.staffId}</span>}
          </div>
        )}

        <div className="input-group">
          <input
            ref={inputRefs.password}
            name="password"
            type="password"
            value={formData.password}
            placeholder="Password"
            className={errors.password ? 'input-error' : ''}
            onChange={handleChange}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <div className="input-group">
          <input
            ref={inputRefs.confirmPassword}
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            placeholder="Confirm Password"
            className={errors.confirmPassword ? 'input-error' : ''}
            onChange={handleChange}
          />
          {errors.confirmPassword && (
            <span className="error-text">{errors.confirmPassword}</span>
          )}
        </div>

        <button type="submit">Register</button>

        <div className="bottom-section">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/option')}
          >
            Already have an account? Login
          </button>
          <div className={`form-message ${messageType}`}>
            {message || <span>&nbsp;</span>}
          </div>
        </div>
      </form>
    </div>
  );
};

export default UnifiedRegister;
