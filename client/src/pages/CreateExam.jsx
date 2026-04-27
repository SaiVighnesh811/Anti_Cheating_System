import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PlusCircle, Trash2, ArrowLeft, Save, Image as ImageIcon, Type, Edit3, AlertCircle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', marginTop: '5rem' }}>
          <h2 style={{color: 'var(--danger)'}}>Something went wrong. Please refresh.</h2>
        </div>
      );
    }
    return this.props.children;
  }
}

const CreateExam = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  // Helper to format Date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatToDateTimeLocal = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const z = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d - z);
    return local.toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allowedStudents, setAllowedStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [questions, setQuestions] = useState([
    { type: 'mcq-text', questionType: 'single', correctAnswer: [], questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctOptionIndex: 0, correctAnswerText: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');

  // Fetch available students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (user?.role === 'admin' || user?.role === 'superadmin') {
          const { data } = await api.get('/students');
          console.log("Students:", data);
          setAvailableStudents(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch students", err);
      }
    };
    fetchStudents();
  }, [user]);

  // Initialize or Fetch Data
  useEffect(() => {
    if (isEditMode) {
      const fetchExam = async () => {
        setLoading(true);
        try {
          const { data } = await api.get(`/exams/${id}`);
          setTitle(data.title || '');
          setDescription(data.description || '');
          setDurationMinutes(data.durationMinutes || 60);
          
          if (data.startTime) {
            setStartTime(formatToDateTimeLocal(data.startTime));
          }
          if (data.endTime) {
            setEndTime(formatToDateTimeLocal(data.endTime));
          }
          
          let loadedQuestions = data.questions || [];
          if (!Array.isArray(loadedQuestions)) loadedQuestions = [];
          
          loadedQuestions = loadedQuestions.map(q => {
            let parsedCorrectAnswer = q.correctAnswer;
            if (typeof parsedCorrectAnswer === 'string') {
              parsedCorrectAnswer = [parsedCorrectAnswer];
            } else if (!Array.isArray(parsedCorrectAnswer)) {
              parsedCorrectAnswer = [];
            }
            return {
              ...q,
              questionType: q.questionType || 'single',
              correctAnswer: parsedCorrectAnswer
            };
          });
          
          setQuestions(loadedQuestions);
          console.log("Exam:", data);
          console.log("Questions:", loadedQuestions);
          setAllowedStudents(data.allowedStudents || []);
        } catch (err) {
          setError('Failed to load exam data');
          showToast('Failed to load exam data', 'error');
        } finally {
          setLoading(false);
        }
      };
      fetchExam();
    } else {
      setTitle('');
    }
  }, [id, isEditMode]);

  // Auto-calculate end time based on start time and duration
  React.useEffect(() => {
    if (startTime && durationMinutes) {
      try {
        const start = new Date(startTime);
        if (!isNaN(start.getTime())) {
          const end = new Date(start.getTime() + durationMinutes * 60000);
          
          // Format to YYYY-MM-DDTHH:mm for datetime-local input
          const year = end.getFullYear();
          const month = String(end.getMonth() + 1).padStart(2, '0');
          const day = String(end.getDate()).padStart(2, '0');
          const hours = String(end.getHours()).padStart(2, '0');
          const minutes = String(end.getMinutes()).padStart(2, '0');
          
          setEndTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
      } catch (err) {
        console.error("Error calculating end time:", err);
      }
    }
  }, [startTime, durationMinutes]);

  const addQuestion = () => {
    setQuestions(Array.isArray(questions) ? [...questions, { type: 'mcq-text', questionType: 'single', correctAnswer: [], questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctOptionIndex: 0, correctAnswerText: '' }] : [{ type: 'mcq-text', questionType: 'single', correctAnswer: [], questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctOptionIndex: 0, correctAnswerText: '' }]);
  };

  const removeQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex, optIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[optIndex] = value;
    setQuestions(newQuestions);
  };

  const handleImageUpload = (qIndex, field, e, optIndex = null) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const newQuestions = [...questions];
      if (optIndex !== null) {
        newQuestions[qIndex].optionImages[optIndex] = reader.result;
      } else {
        newQuestions[qIndex][field] = reader.result;
      }
      setQuestions(newQuestions);
    };
    reader.readAsDataURL(file);
  };

  const removeOptionImage = (qIndex, optIndex) => {
     const newQuestions = [...questions];
     newQuestions[qIndex].optionImages[optIndex] = '';
     setQuestions(newQuestions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // basic validation
    if (!title || questions.length === 0) {
      setError('Title and at least 1 question are required');
      setLoading(false);
      return;
    }

    // deep validation
    for (let q of questions) {
      if (q.type === 'fill-in-blank') {
         if (!q.questionText || !q.correctAnswerText) {
            setError('Fill-in-the-blank questions require text and a correct answer.');
            setLoading(false);
            return;
         }
      } else if (q.type === 'mcq-image') {
         if (!q.questionImage && !q.questionText) {
            setError('MCQ Image requires a question text or image.');
            setLoading(false);
            return;
         }
         if (q.options.some((o, i) => !o && (!q.optionImages || !q.optionImages[i]))) {
            setError('All MCQ options must have text or an image.');
            setLoading(false);
            return;
         }
      } else {
         if (!q.questionText || q.options.some(o => !o)) {
            setError('All questions and options must be filled');
            setLoading(false);
            return;
         }
      }
    }
    try {
      const payload = { 
        title, 
        description, 
        durationMinutes, 
        startTime: startTime || null,
        endTime: endTime || null,
        questions,
        allowedStudents
      };

      if (isEditMode) {
        await api.put(`/exams/${id}`, payload);
        showToast('Exam updated successfully ✅', 'success');
      } else {
        await api.post('/exams', payload);
        showToast('Exam published successfully ✅', 'success');
      }

      if (user?.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = Array.isArray(availableStudents) ? availableStudents.filter(s =>
    (s.name?.toLowerCase() || '').includes((searchText || '').toLowerCase()) ||
    (s.email?.toLowerCase() || '').includes((searchText || '').toLowerCase())
  ) : [];

  return (
    <div className="page-container" style={{ maxWidth: '900px', padding: '2rem', animation: 'fadeIn 0.6s ease-out' }}>
      <button onClick={() => navigate(user?.role === 'superadmin' ? '/superadmin-dashboard' : '/admin')} className="btn-secondary" style={{ marginBottom: '2.5rem', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: '600' }}>
        <ArrowLeft size={18} /> {user?.role === 'superadmin' ? 'Super Admin Console' : 'Teacher Console'}
      </button>

      <div className="glass-panel" style={{ padding: '3.5rem', background: '#fff', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
            {isEditMode ? 'Modify Assessment' : 'Curate New Assessment'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.05rem' }}>
            {isEditMode ? 'Update evaluation parameters and refine question sets.' : 'Define evaluation parameters and secure question sets.'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2.5rem', border: '1px solid rgba(220,38,38,0.1)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment Title</label>
              <input
                type="text"
                className="input-field-enhanced"
                placeholder="e.g. Advanced Thermodynamics Midterm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Duration (m)</label>
              <input
                type="number"
                className="input-field-enhanced"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule Start (Optional)</label>
              <input 
                type="datetime-local" 
                className="input-field-enhanced"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule End (Auto-calculated)</label>
              <input 
                type="datetime-local" 
                className="input-field-enhanced"
                value={endTime}
                readOnly
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'not-allowed' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontWeight: '500' }}>Calculated based on start time and duration.</p>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '3rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate Instructions</label>
            <textarea
              className="input-field-enhanced"
              style={{ minHeight: '100px', resize: 'vertical', width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              placeholder="Provide context or rules for this examination..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Access Control (Optional)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', color: 'var(--primary)' }}>
                <input 
                  type="checkbox" 
                  checked={Array.isArray(allowedStudents) && Array.isArray(availableStudents) && allowedStudents.length === availableStudents.length && availableStudents.length > 0} 
                  onChange={(e) => setAllowedStudents(e.target.checked && Array.isArray(availableStudents) ? availableStudents.map(s => s.userId) : [])} 
                  style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }} />
                Select All Students
              </label>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>If no students are selected, the exam will be accessible to all registered students by default.</p>
            <input 
               type="text" 
               placeholder="Search students..." 
               value={searchText} 
               onChange={(e) => setSearchText(e.target.value || "")} 
               className="input-field-enhanced" 
               style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: '1.5px solid #e2e8f0' }} 
            />
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
               {!availableStudents ? (
                 <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '1rem 0' }}>Loading students...</p>
               ) : filteredStudents.length === 0 ? (
                 <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '1rem 0' }}>No students found.</p>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   {filteredStudents.map(student => (
                     <label key={student.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s', background: Array.isArray(allowedStudents) && allowedStudents.includes(student.userId) ? 'rgba(13,148,136,0.05)' : 'transparent' }} onMouseOver={e => e.currentTarget.style.background = Array.isArray(allowedStudents) && allowedStudents.includes(student.userId) ? 'rgba(13,148,136,0.05)' : '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = Array.isArray(allowedStudents) && allowedStudents.includes(student.userId) ? 'rgba(13,148,136,0.05)' : 'transparent'}>
                       <input 
                         type="checkbox" 
                         checked={Array.isArray(allowedStudents) && allowedStudents.includes(student.userId)}
                         onChange={(e) => {
                           if (e.target.checked) setAllowedStudents(prev => Array.isArray(prev) ? [...prev, student.userId] : [student.userId]);
                           else setAllowedStudents(prev => Array.isArray(prev) ? prev.filter(id => id !== student.userId) : []);
                         }}
                         style={{ accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                       />
                       <div>
                         <span style={{ display: 'block', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{student.name}</span>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{student.email}</span>
                       </div>
                     </label>
                   ))}
                 </div>
               )}
            </div>
          </div>

          <div style={{ margin: '4rem 0 2rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary-light)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Question Reservoir</h2>
            <button type="button" onClick={addQuestion} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.2rem', fontWeight: '700' }}>
              <PlusCircle size={18} /> New Question
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {Array.isArray(questions) && questions.map((q, qIndex) => (
              <div key={qIndex} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', padding: '2rem', borderRadius: '18px', position: 'relative', transition: 'all 0.3s ease' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(qIndex)} className="btn-danger" style={{ padding: '0.5rem', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: 'none' }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ background: 'var(--primary)', color: '#fff', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem' }}>{qIndex + 1}</span>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>Question Format</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {q.type !== 'fill-in-blank' && (
                      <select
                         className="input-field-enhanced"
                         style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontWeight: '600' }}
                         value={q.questionType || 'single'}
                         onChange={(e) => {
                           updateQuestion(qIndex, 'questionType', e.target.value);
                           if (e.target.value === 'single') {
                             updateQuestion(qIndex, 'correctAnswer', q.correctAnswer?.length ? [q.correctAnswer[0]] : []);
                           }
                         }}
                      >
                         <option value="single">Single Correct</option>
                         <option value="multiple">Multiple Correct</option>
                      </select>
                    )}
                    <select
                       className="input-field-enhanced"
                       style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontWeight: '600' }}
                       value={q.type || 'mcq-text'}
                       onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                    >
                       <option value="mcq-text">MCQ (Text)</option>
                       <option value="mcq-image">MCQ (Image)</option>
                       <option value="fill-in-blank">Fill in the Blank</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                     <input
                       type="text"
                       className="input-field-enhanced"
                       placeholder="Problem statement..."
                       value={q.questionText}
                       onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                       required={q.type === 'mcq-text' || q.type === 'fill-in-blank'}
                       style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white' }}
                     />
                     {q.type === 'mcq-image' && (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                           <input type="file" accept="image/*" onChange={(e) => handleImageUpload(qIndex, 'questionImage', e)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }} />
                           <div style={{ padding: '0.85rem 1.25rem', background: '#f1f5f9', border: '1.5px dashed #cbd5e1', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                              <ImageIcon size={18} /> Upload Image
                           </div>
                        </div>
                     )}
                  </div>
                  {q.questionImage && (
                     <div style={{ marginTop: '1rem', position: 'relative', width: 'fit-content' }}>
                        <img src={q.questionImage} alt="Preview" style={{ maxHeight: '150px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        <button type="button" onClick={() => updateQuestion(qIndex, 'questionImage', '')} style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '24px', height: '24px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>×</button>
                     </div>
                  )}
                </div>

                {q.type === 'fill-in-blank' ? (
                   <div style={{ marginTop: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}><Edit3 size={15}/> Correct Answer</label>
                      <input
                        type="text"
                        className="input-field-enhanced"
                        placeholder="Type exact correct answer..."
                        value={q.correctAnswerText || ''}
                        onChange={(e) => updateQuestion(qIndex, 'correctAnswerText', e.target.value)}
                        required
                        style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}
                      />
                   </div>
                ) : (
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                     {q.options.map((opt, optIndex) => (
                       <div key={optIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'white', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', position: 'relative' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                             <input
                               type={q.questionType === 'multiple' ? "checkbox" : "radio"}
                               name={`correct-${qIndex}`}
                               checked={q.questionType === 'multiple' ? (Array.isArray(q.correctAnswer) && (q.correctAnswer.includes(String(optIndex)) || q.correctAnswer.includes(opt))) : q.correctOptionIndex === optIndex}
                               onChange={() => {
                                 if (q.questionType === 'multiple') {
                                   let currentAns = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                                   const val = opt || String(optIndex);
                                   if (currentAns.includes(val) || currentAns.includes(String(optIndex))) {
                                     updateQuestion(qIndex, 'correctAnswer', currentAns.filter(a => a !== val && a !== String(optIndex)));
                                   } else {
                                     updateQuestion(qIndex, 'correctAnswer', [...currentAns, val]);
                                   }
                                 } else {
                                   updateQuestion(qIndex, 'correctOptionIndex', optIndex);
                                   updateQuestion(qIndex, 'correctAnswer', [opt || String(optIndex)]);
                                 }
                               }}
                               style={{ cursor: 'pointer', width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                             />
                            <input
                              type="text"
                              className="input-field-enhanced"
                              placeholder={`Option ${optIndex + 1}`}
                              value={opt}
                              onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                              required={q.type === 'mcq-text'}
                              style={{ padding: '0.5rem 0', border: 'none', background: 'transparent', width: '100%', fontWeight: q.correctOptionIndex === optIndex ? '600' : '400' }}
                            />
                         </div>
                         {q.type === 'mcq-image' && (
                            <div style={{ marginLeft: '2.5rem', marginTop: '0.5rem' }}>
                               {q.optionImages?.[optIndex] ? (
                                  <div style={{ position: 'relative', width: 'fit-content' }}>
                                     <img src={q.optionImages[optIndex]} alt="Option Preview" style={{ maxHeight: '80px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                                     <button type="button" onClick={() => removeOptionImage(qIndex, optIndex)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                  </div>
                               ) : (
                                  <div style={{ position: 'relative', width: 'fit-content' }}>
                                     <input type="file" accept="image/*" onChange={(e) => handleImageUpload(qIndex, null, e, optIndex)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }} />
                                     <button type="button" style={{ fontSize: '0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.35rem 0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                                        <ImageIcon size={14} /> Add Image
                                     </button>
                                  </div>
                               )}
                            </div>
                         )}
                       </div>
                     ))}
                   </div>
                )}
              </div>
            ))}
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '4rem', width: '100%', padding: '1.25rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', fontSize: '1.2rem', fontWeight: '800' }} disabled={loading}>
            <Save size={24} />
            {loading ? (isEditMode ? 'Updating...' : 'Publishing...') : (isEditMode ? 'Update Assessment' : 'Publish Assessment')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default function CreateExamWrapper(props) {
  return (
    <ErrorBoundary>
      <CreateExam {...props} />
    </ErrorBoundary>
  );
}
