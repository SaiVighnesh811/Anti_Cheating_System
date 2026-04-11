import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, FileText, AlertTriangle, LogOut, Filter, RefreshCw } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ── Activity Timeline Component ────────────────────────────────────────────
const getEventMeta = (type) => {
  if (type === 'TAB_SWITCH' || type === 'tab-switch') {
    return { label: 'Tab switch detected', icon: '⚠️', color: '#f59e0b', dotColor: '#f59e0b', bg: 'var(--primary-light)' };
  }
  if (type === 'FULLSCREEN_EXIT' || type === 'fullscreen-exit') {
    return { label: 'Fullscreen exit', icon: '⚠️', color: '#ef4444', dotColor: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
  }
  if (type === 'EXAM_START' || type === 'exam-start') {
    return { label: 'Exam started', icon: '🔵', color: 'var(--primary)', dotColor: 'var(--primary)', bg: 'var(--primary-light)' };
  }
  if (type === 'RETURNED' || type === 'returned') {
    return { label: 'Returned to exam', icon: '✅', color: 'var(--success)', dotColor: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)' };
  }
  return { label: `Event: ${type}`, icon: '🔵', color: '#6366f1', dotColor: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' };
};

const ActivityTimeline = ({ history }) => {
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [history]);

  return (
    <div className="timeline-panel" style={{ marginTop: '0.5rem' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.25rem',
        padding: '0.85rem 1.1rem',
        background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDarkMode ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)'}`,
        borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.05rem' }}>🕐</span>
          <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Activity Timeline
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '999px', padding: '0.25rem 0.7rem'
        }}>
          <span className="tl-live-dot" />
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ef4444', letterSpacing: '0.08em' }}>LIVE</span>
        </div>
      </div>

      {/* Timeline body */}
      <div style={{
        background: isDarkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
        borderRadius: '14px',
        padding: '1rem 1rem 0.5rem 1rem',
        maxHeight: '320px',
        overflowY: 'auto',
      }}>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            No violations recorded
          </div>
        ) : (
          <ul className="timeline-list">
            {history.map((log, idx) => {
              const meta = getEventMeta(log.type);
              const ts = new Date(log.timestamp);
              const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const animDelay = `${idx * 0.07}s`;
              return (
                <li
                  key={idx}
                  className="timeline-item"
                  style={{ animationDelay: animDelay }}
                >
                  <div className="timeline-time">{timeStr}</div>
                  <div className="timeline-dot-wrap">
                    <div className="timeline-dot" style={{ borderColor: meta.dotColor, background: meta.dotColor + '22' }} />
                  </div>
                  <div className="timeline-content" style={{ background: meta.bg }}>
                    <span className="timeline-icon">{meta.icon}</span>
                    <span className="timeline-label" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                </li>
              );
            })}
            <div ref={endRef} style={{ height: '1px' }} />
          </ul>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [exams, setExams] = useState([]);
  const [rawViolations, setRawViolations] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentGroup, setSelectedStudentGroup] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  const [reportLoading, setReportLoading] = useState(false);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedRole = localStorage.getItem('theme');
    return savedRole === 'dark';
  });

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  // ── REPORT GENERATION LOGIC ──────────────────────────────────────────────
  const generateStudentPDF = (reportData) => {
    const { attempt, violations } = reportData;
    const doc = new jsPDF();

    let y = 20;
    const leftCol = 20;

    // Theme colors: Purple/Violet (#8b5cf6)
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, 210, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Student Exam Report - Anti-Cheating System", 105, 13, { align: "center" });

    // A. STUDENT DETAILS
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    y += 15;
    doc.setFont(undefined, 'bold');
    doc.text("A. Student Details", leftCol, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    const studentName = attempt.student?.name || 'Unknown';
    doc.text(`Name / ID: ${studentName}`, leftCol, y);
    y += 7;
    doc.text(`Exam Title: ${attempt.exam?.title || 'Unknown'}`, leftCol, y);
    y += 7;
    doc.text(`Exam Date: ${new Date(attempt.createdAt).toLocaleDateString()}`, leftCol, y);
    y += 7;

    // ADDING START/END TIMES
    const startTime = new Date(attempt.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = attempt.completedAt ? new Date(attempt.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    doc.setFont(undefined, 'bold');
    doc.text(`Start Time: ${startTime}`, leftCol, y);
    y += 7;
    doc.text(`End Time:   ${endTime}`, leftCol, y);
    y += 3;

    // B. PERFORMANCE
    y += 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("B. Performance", leftCol, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');

    const totalQuestions = attempt.exam?.questions?.length || 0;
    const correct = attempt.score || 0;
    const attempted = attempt.answers?.length || 0;
    const wrong = attempted - correct;
    const percentage = totalQuestions > 0 ? ((correct / totalQuestions) * 100).toFixed(1) : 0;

    doc.text(`Total Questions: ${totalQuestions}`, leftCol, y);
    y += 7;
    doc.text(`Correct Answers: ${correct}`, leftCol, y);
    y += 7;
    doc.text(`Wrong Answers: ${wrong}`, leftCol, y);
    y += 7;
    doc.text(`Final Score: ${correct} / ${totalQuestions} (${percentage}%)`, leftCol, y);

    // C. VIOLATIONS
    y += 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("C. Violations Breakdown", leftCol, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    let tabSwitchCount = 0;
    let fsExitCount = 0;

    violations.forEach(v => {
      if (v.type === 'TAB_SWITCH' || v.type === 'tab-switch') tabSwitchCount++;
      if (v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit') fsExitCount++;
    });

    doc.text(`Total Violations: ${violations.length}`, leftCol, y);
    y += 7;
    doc.text(`Tab Switching: ${tabSwitchCount}`, leftCol + 10, y);
    y += 7;
    doc.text(`Fullscreen Exit: ${fsExitCount}`, leftCol + 10, y);

    // D. SUSPICION SCORE
    y += 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("D. Suspicion Score", leftCol, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    const suspicionScore = (tabSwitchCount * 10) + (fsExitCount * 15);
    doc.text(`Suspicion Score: ${suspicionScore}`, leftCol, y);
    y += 7;

    let riskLabel = "Low Risk - Secure Session";
    let riskColor = [22, 163, 74];
    if (suspicionScore > 40 || violations.length >= 3) {
      riskLabel = "High Risk - Attention Required";
      riskColor = [220, 38, 38];
    } else if (suspicionScore > 15 || violations.length > 0) {
      riskLabel = "Medium Risk - Notice Issued";
      riskColor = [202, 138, 4];
    }

    doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text(`Risk Assessment: ${riskLabel}`, leftCol, y);
    doc.setTextColor(30, 30, 30);
    doc.setFont(undefined, 'normal');
    y += 3;

    // E. VIOLATIONS LOG
    y += 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("E. Violations Log", leftCol, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    if (violations.length === 0) {
      doc.text("No policy violations recorded during this session.", leftCol, y);
    } else {
      violations.forEach((v, index) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        let desc = "";
        if (v.type === 'TAB_SWITCH' || v.type === 'tab-switch') desc = "Tab / Window Switching";
        else if (v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit') desc = "Fullscreen Exit Detected";
        else desc = v.type;

        doc.text(`${index + 1}. [${new Date(v.timestamp).toLocaleTimeString()}] ${desc}`, leftCol, y);
        y += 7;
      });
    }

    return { doc, filename: `Report_${studentName.replace(/\s+/g, '_')}_${attempt.exam?._id}.pdf` };
  };

  const handleDownloadReport = async (e, studentId, examId) => {
    e.stopPropagation();
    try {
      setReportLoading(true);
      const { data } = await api.get(`/report/${studentId}/${examId}`);
      const { doc, filename } = generateStudentPDF(data);
      doc.save(filename);
    } catch (err) {
      console.error("Download fail", err);
      alert("Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadAllReports = async () => {
    try {
      setReportLoading(true);
      const zip = new JSZip();
      const folder = zip.folder("Student_Reports");

      for (const attempt of attempts) {
        if (!attempt.student || !attempt.exam) continue;
        try {
          const { data } = await api.get(`/report/${attempt.student._id}/${attempt.exam._id}`);
          const { doc, filename } = generateStudentPDF(data);
          const pdfOutput = doc.output('blob');
          folder.file(filename, pdfOutput);
        } catch (err) {
          console.error("Failed to generate for attempt", err);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "reports.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Bulk download fail", err);
      alert("Failed to generate bulk reports.");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      console.log("Fetching dashboard...");
      try {
        const timeParam = new Date().getTime();
        const config = { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } };
        const [examsRes, violationsRes, attemptsRes] = await Promise.all([
          api.get(`/exams?t=${timeParam}`, config),
          api.get(`/attempts/violations/all?t=${timeParam}`, config),
          api.get(`/attempts/all?t=${timeParam}`, config)
        ]);
        console.log("Updated data: exams/violations/attempts", {
          exams: examsRes.data.length,
          violations: violationsRes.data.length,
          attempts: attemptsRes.data.length
        });
        setExams(examsRes.data);
        setRawViolations(violationsRes.data);
        // Only include student attempts in the results table
        setAttempts(attemptsRes.data.filter(a => a.student && a.student.role === 'student'));
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    const dashboardInterval = setInterval(fetchDashboardData, 2000); // Poll every 2s

    // Force fetch on tab return (bypass browser throttling)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(dashboardInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── Live Proctoring Polling ──────────────────────────────────────────────
  const [liveStudents, setLiveStudents] = useState([]);
  const [liveLastUpdated, setLiveLastUpdated] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  useEffect(() => {
    const fetchLive = async () => {
      console.log("Fetching live dashboard...");
      try {
        const config = { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } };
        const { data } = await api.get(`/attempts/live?t=${new Date().getTime()}`, config);
        console.log("Updated live data:", data);
        setLiveStudents(data);
        setLiveLastUpdated(new Date());

        // VANILLA JS DOM MANIPULATION FIX AS REQUESTED
        const renderDashboard = (fetchedData) => {
          const container = document.getElementById("studentContainer");
          if (!container) return;

          // CLEAR OLD DATA
          container.innerHTML = "";

          // HANDLE EMPTY DATA CASE
          if (!fetchedData || fetchedData.length === 0) {
            container.innerHTML = `
              <div style="text-align: center; padding: 2.5rem 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📭</div>
                <p style="color: var(--text-secondary); font-size: 1rem;">No active students</p>
              </div>
            `;
            return;
          }

          // LOOP THROUGH DATA
          const grid = document.createElement("div");
          grid.style.display = "grid";
          grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
          grid.style.gap = "1rem";

          fetchedData.forEach((s) => {
            const isHighRisk = s.totalViolations >= 3;
            const hasTabSwitch = s.tabSwitches > 0;

            let statusLabel, statusColor, statusBg, statusIcon;
            if (isHighRisk) {
              statusLabel = 'High Risk'; statusIcon = '🚨';
              statusColor = 'var(--danger)'; statusBg = 'rgba(239, 68, 68, 0.18)';
            } else if (hasTabSwitch || s.lastViolationType === 'TAB_SWITCH' || s.lastViolationType === 'tab-switch') {
              statusLabel = 'Tab Switched'; statusIcon = '🚫';
              statusColor = '#fb923c'; statusBg = 'rgba(251, 146, 60, 0.15)';
            } else if (s.totalViolations > 0) {
              statusLabel = 'Warning'; statusIcon = '⚠️';
              statusColor = 'var(--warning)'; statusBg = 'rgba(245, 158, 11, 0.15)';
            } else {
              statusLabel = 'Active'; statusIcon = '✅';
              statusColor = 'var(--success)'; statusBg = 'rgba(16, 185, 129, 0.12)';
            }

            const cardBorder = isHighRisk ? '1.5px solid rgba(239, 68, 68, 0.6)' : '1px solid var(--surface-border)';
            const cardBg = isHighRisk 
              ? (isDarkMode ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.04)') 
              : 'var(--surface-card)';

            const div = document.createElement("div");
            div.style.cssText = `background: ${cardBg}; border: ${cardBorder}; border-radius: 14px; padding: 1.25rem; transition: all var(--transition-speed) ease; position: relative; overflow: hidden;`;

            div.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div>
                  <h3 style="margin: 0 0 0.25rem 0; font-size: 1.1rem; color: var(--text-primary); font-weight: 700;">
                    ${s.student?.name || 'Unknown Student'}
                  </h3>
                  <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">
                    Exam ID: ${s.exam?._id || 'Unknown'}
                  </p>
                </div>
                <div style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}44; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;">
                  ${statusIcon} ${statusLabel}
                </div>
              </div>
              
              <div style="background: ${isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)'}; border-radius: 8px; padding: 0.85rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--surface-border);">
                <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Total Violations</span>
                <span style="font-size: 1.1rem; font-weight: 800; color: ${isHighRisk ? 'var(--danger)' : 'var(--text-primary)'};">
                  ${s.totalViolations}
                </span>
              </div>
              
              ${s.totalViolations > 0 ? `
                <div style="margin-top: 0.85rem; background: ${isDarkMode ? 'rgba(251, 146, 60, 0.1)' : 'rgba(251, 146, 60, 0.05)'}; border-radius: 6px; padding: 0.6rem; font-size: 0.75rem; color: #fb923c; display: flex; align-items: center; gap: 0.4rem; font-weight: 600; border: 1px solid rgba(251, 146, 60, 0.2);">
                  ⚠️ Last: ${s.lastViolationType}
                </div>
              ` : ''}
            `;
            grid.appendChild(div);
          });

          container.appendChild(grid);
        };

        renderDashboard(data);

      } catch (err) {
        console.error('Error fetching live data', err);
      } finally {
        setLiveLoading(false);
        setLiveRefreshing(false);
      }
    };

    const handleManualRefresh = () => {
      setLiveRefreshing(true);
      fetchLive();
    };

    fetchLive(); // Initial fetch
    const interval = setInterval(fetchLive, 2000); // Poll every 2s

    // Force fetch on tab return
    const handleLiveVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLive();
      }
    };
    document.addEventListener('visibilitychange', handleLiveVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleLiveVisibility);
    };
  }, []);

  // Filter violations by selected exam
  const filteredViolations = useMemo(() => {
    let filtered = rawViolations;
    if (selectedExamId !== 'all') {
      filtered = rawViolations.filter(v => v.exam?._id === selectedExamId || v.exam === selectedExamId);
    }
    // Final safeguard: Only include students
    return filtered.filter(v => v.student && v.student.role === 'student');
  }, [rawViolations, selectedExamId]);

  // Group filtered violations by student
  const violations = useMemo(() => {
    const grouped = filteredViolations.reduce((acc, v) => {
      const sId = v.student?._id;
      if (!sId) return acc;
      if (!acc[sId]) {
        acc[sId] = { student: v.student, total: 0, tab: 0, fullscreen: 0, history: [] };
      }
      acc[sId].total += 1;
      acc[sId].history.push(v);
      if (v.type === 'TAB_SWITCH' || v.type === 'tab-switch') acc[sId].tab += 1;
      if (v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit') acc[sId].fullscreen += 1;
      return acc;
    }, {});

    // Add Suspicion Score logic
    const results = Object.values(grouped).map(g => {
      g.suspicionScore = (g.tab * 10) + (g.fullscreen * 15);
      if (g.suspicionScore > 50) {
        g.riskLevel = 'high';
        g.riskLabel = 'High Risk';
        g.riskColor = 'var(--danger)';
        g.riskBg = 'rgba(239, 68, 68, 0.15)';
      } else if (g.suspicionScore >= 20) {
        g.riskLevel = 'medium';
        g.riskLabel = 'Medium Risk';
        g.riskColor = 'var(--warning)';
        g.riskBg = 'rgba(245, 158, 11, 0.15)';
      } else {
        g.riskLevel = 'low';
        g.riskLabel = 'Low Risk';
        g.riskColor = 'var(--success)';
        g.riskBg = 'rgba(16, 185, 129, 0.15)';
      }
      return g;
    });

    // Filter by risk level
    let filteredResults = results;
    if (selectedRiskLevel !== 'all') {
      filteredResults = results.filter(g => g.riskLevel === selectedRiskLevel);
    }

    // Sort by suspicion score (highest to lowest)
    return filteredResults.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }, [filteredViolations, selectedRiskLevel]);

  // Chart data
  const barChartData = useMemo(() => {
    const top10 = violations.slice(0, 10);
    return {
      labels: top10.map(g => g.student.name),
      datasets: [{
        label: 'Violation Frequency',
        data: top10.map(g => g.total),
        backgroundColor: 'rgba(13, 148, 136, 0.7)', // Teal-600
        borderColor: 'rgba(13, 148, 136, 1)',
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: 'rgba(13, 148, 136, 0.9)',
      }]
    };
  }, [violations]);

  const pieChartData = useMemo(() => {
    return {
      labels: ['Tab Switch', 'Fullscreen Exit'],
      datasets: [{
        data: [
          filteredViolations.filter(v => v.type === 'TAB_SWITCH' || v.type === 'tab-switch').length,
          filteredViolations.filter(v => v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit').length
        ],
        backgroundColor: [
          'rgba(245, 158, 11, 0.7)', // Warning Amber
          'rgba(239, 68, 68, 0.7)'   // Danger Red
        ],
        borderColor: [
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)'
        ],
        borderWidth: 2
      }]
    };
  }, [filteredViolations]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true,
        position: 'top',
        labels: { 
          color: isDarkMode ? '#f1f5f9' : '#1e293b', 
          font: { size: 12, weight: '600', family: 'Inter' },
          padding: 20,
          usePointStyle: true
        } 
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#1e293b' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDarkMode ? '#f1f5f9' : '#0f172a',
        bodyColor: isDarkMode ? '#94a3b8' : '#475569',
        borderColor: 'rgba(13, 148, 136, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        boxPadding: 6,
        usePointStyle: true
      }
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { weight: '500' } }
      },
      y: { 
        beginAtZero: true, 
        grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', drawBorder: false },
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', stepSize: 1, font: { weight: '500' } }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          color: isDarkMode ? '#f1f5f9' : '#1e293b', 
          font: { size: 12, weight: '600' },
          padding: 20,
          usePointStyle: true
        } 
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#1e293b' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDarkMode ? '#f1f5f9' : '#0f172a',
        bodyColor: isDarkMode ? '#94a3b8' : '#475569',
        padding: 12,
        cornerRadius: 10,
        boxPadding: 6
      }
    }
  };

  if (loading) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Dashboard...</div>;

  return (
    <div className="dashboard-theme-provider">
      <div className="page-container" style={{ transition: 'all var(--transition-speed) ease' }}>
      {/* ── Theme & Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        :root {
          --transition-speed: 0.3s;
        }

        .dashboard-theme-provider {
          --bg-dashboard: ${isDarkMode ? '#0f172a' : '#f8fafc'};
          --surface-panel: ${isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#ffffff'};
          --surface-card: ${isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
          --card-hover: ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#fdfdfd'};
          --text-primary: ${isDarkMode ? '#f1f5f9' : '#111827'};
          --text-secondary: ${isDarkMode ? '#94a3b8' : '#4b5563'};
          --surface-border: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'};
          --card-shadow: ${isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(0, 0, 0, 0.04)'};
          --primary: #0d9488;
          --primary-light: ${isDarkMode ? 'rgba(13, 148, 136, 0.15)' : 'rgba(13, 148, 136, 0.06)'};
          
          min-height: 100vh;
          background-color: var(--bg-dashboard);
          color: var(--text-primary);
          transition: background-color var(--transition-speed), color var(--transition-speed);
          font-family: 'Inter', sans-serif;
        }

        .glass-panel {
          background: var(--surface-panel) !important;
          border: 1px solid var(--surface-border) !important;
          box-shadow: var(--card-shadow) !important;
          transition: all var(--transition-speed) ease;
        }

        .timeline-panel {
          font-family: 'Inter', sans-serif;
        }
        .timeline-list {
          position: relative;
          padding-left: 0;
          list-style: none;
          margin: 0;
        }
        .timeline-list::before {
          content: '';
          position: absolute;
          left: 54px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: linear-gradient(180deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0.08) 100%);
          border-radius: 2px;
        }
        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 0;
          padding: 0.55rem 0.5rem 0.55rem 0;
          border-radius: 10px;
          transition: background 0.2s ease, transform 0.18s ease;
          animation: tl-fadein 0.45s ease both;
          cursor: default;
        }
        .timeline-item:hover {
          background: rgba(139, 92, 246, 0.07);
          transform: translateX(3px);
        }
        .timeline-time {
          width: 48px;
          flex-shrink: 0;
          font-size: 0.72rem;
          font-weight: 600;
          color: #94a3b8;
          text-align: right;
          padding-top: 3px;
          letter-spacing: 0.02em;
          line-height: 1.2;
        }
        .timeline-dot-wrap {
          width: 14px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 4px;
          margin: 0 8px;
        }
        .timeline-dot {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          border: 2px solid;
          background: var(--surface-panel);
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        .timeline-content {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0.5rem;
          border-radius: 8px;
          min-height: 32px;
        }
        .timeline-icon {
          font-size: 1.05rem;
          flex-shrink: 0;
          line-height: 1;
        }
        .timeline-label {
          font-size: 0.875rem;
          font-weight: 500;
          line-height: 1.3;
        }
        .tl-live-dot {
          display: inline-block;
          width: 9px;
          height: 9px;
          background: #ef4444;
          border-radius: 50%;
          animation: tl-blink 1.2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes tl-fadein {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tl-blink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50%       { opacity: 0.5; box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          transition: background 0.2s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, color: 'var(--text-primary)' }}>Admin Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {user?.name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={toggleTheme} 
            className="btn-secondary" 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.6rem 1rem', borderRadius: '12px',
              background: 'var(--surface-panel)', border: '1px solid var(--surface-border)',
              boxShadow: 'var(--card-shadow)'
            }}
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Loading Overlay for Reporting */}
      {reportLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <RefreshCw size={48} className="spin-animation" color="#8b5cf6" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: 'white' }}>Generating report... ⏳</h2>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
           🎥 LIVE PROCTORING DASHBOARD
          ═══════════════════════════════════════════════════════ */}
      <div className="glass-panel" style={{ 
        padding: '2rem', 
        marginBottom: '3rem', 
        border: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)'}`, 
        background: isDarkMode ? 'rgba(139, 92, 246, 0.04)' : 'rgba(139, 92, 246, 0.02)' 
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              🎥 Live Proctoring
            </h2>
            {/* Pulsing live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--success)',
                boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)',
                animation: 'livePulse 1.5s infinite'
              }} />
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--success)', letterSpacing: '0.05em' }}>LIVE</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Refresh Button */}
            <button
              onClick={() => {
                setLiveRefreshing(true);
                // The useEffect interval will continue, but we trigger one now
                const manualFetchLive = async () => {
                  try {
                    const config = { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } };
                    const { data } = await api.get(`/attempts/live?t=${new Date().getTime()}`, config);
                    setLiveStudents(data);
                    setLiveLastUpdated(new Date());
                  } catch (err) {
                    console.error('Manual refresh failed', err);
                  } finally {
                    setLiveRefreshing(false);
                  }
                };
                manualFetchLive();
              }}
              disabled={liveRefreshing}
              className="btn-secondary"
              style={{ 
                padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', 
                background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'var(--surface-panel)',
                border: '1px solid var(--surface-border)'
              }}
            >
              <RefreshCw size={14} className={liveRefreshing ? 'spin-animation' : ''} />
              {liveRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {liveLoading ? 'Connecting...' : liveLastUpdated ? `Updated ${liveLastUpdated.toLocaleTimeString()}` : ''}
              {!liveLoading && <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>• Polling: 2s</span>}
            </div>
          </div>
        </div>

        {/* Body */}
        {liveLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Connecting to live feed...</div>
        ) : liveStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>No students are currently taking an exam.</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', boxShadow: '0 2px 4px rgba(13, 148, 136, 0.1)' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>{liveStudents.length}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>Active Students</span>
              </div>
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--danger)' }}>
                  {liveStudents.filter(s => s.totalViolations >= 3).length}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--danger)', fontWeight: '600' }}>High Risk Detected</span>
              </div>
            </div>

            {/* DOM CONTAINER FOR RENDER_DASHBOARD () */}
            <div id="studentContainer"></div>
          </>
        )}
      </div>

      {/* Analytics Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Violations Per Student
          </h2>
          <div style={{ height: '280px' }}>
            {violations.length > 0 ? (
              <Bar data={barChartData} options={chartOptions} />
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '4rem' }}>No violation data to display.</p>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🧩 Violation Type Distribution
          </h2>
          <div style={{ height: '280px', display: 'flex', justifyContent: 'center' }}>
            {filteredViolations.length > 0 ? (
              <Pie data={pieChartData} options={pieOptions} />
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '4rem' }}>No violation data to display.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Suspicious Students Leaderboard */}
      {violations.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🚨 Top Suspicious Students
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {violations.slice(0, 5).map((group, idx) => {
              const cardBg = idx === 0 
                ? (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 12, 0.05)') 
                : 'var(--surface-card)';
              const cardBorder = idx === 0 
                ? '1.5px solid var(--danger)' 
                : '1px solid var(--surface-border)';
              
              return (
                <div key={group.student._id} style={{ 
                  display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem 1.5rem', 
                  background: cardBg, 
                  borderRadius: '14px', 
                  border: cardBorder,
                  transition: 'all 0.2s ease',
                  boxShadow: idx === 0 ? '0 4px 12px rgba(239, 68, 68, 0.1)' : 'none'
                }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', 
                    background: idx === 0 ? 'var(--danger)' : (isDarkMode ? 'rgba(245, 158, 11, 0.8)' : 'var(--warning)'), 
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '800', fontSize: '0.9rem'
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{group.student.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>{group.riskLabel}</div>
                  </div>
                  <div style={{ 
                    background: idx === 0 ? 'var(--danger)' : 'var(--warning)', 
                    color: '#fff', padding: '0.4rem 1rem', borderRadius: '999px', 
                    fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                  }}>
                    {group.total} violations
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Active Exams</h2>
            <Link to="/admin/create-exam" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <PlusCircle size={16} /> New Exam
            </Link>
          </div>

          {exams.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No active exams currently available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {exams.map(exam => (
                <div key={exam._id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FileText size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '500' }}>{exam.title}</h3>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                    <span>Duration: {exam.durationMinutes}m</span>
                    <span>Questions: {exam.questions.length}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={24} color="var(--warning)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Violations</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Exam Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={14} color="var(--text-secondary)" />
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  style={{
                    background: 'var(--surface-panel)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: '500'
                  }}
                >
                  <option value="all" style={{ background: isDarkMode ? '#1a1a2e' : '#fff' }}>All Exams</option>
                  {exams.map(e => (
                    <option key={e._id} value={e._id} style={{ background: isDarkMode ? '#1a1a2e' : '#fff' }}>{e.title}</option>
                  ))}
                </select>
              </div>

              {/* Risk Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={14} color="var(--text-secondary)" />
                <select
                  value={selectedRiskLevel}
                  onChange={(e) => setSelectedRiskLevel(e.target.value)}
                  style={{
                    background: 'var(--surface-panel)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: '500'
                  }}
                >
                  <option value="all" style={{ background: isDarkMode ? '#1a1a2e' : '#fff' }}>All Risks</option>
                  <option value="high" style={{ background: isDarkMode ? '#1a1a2e' : '#fff' }}>High Risk</option>
                  <option value="medium" style={{ background: isDarkMode ? '#1a1a2e' : '#fff' }}>Medium Risk</option>
                  <option value="low" style={{ background: isDarkMode ? '#1a1a2e' : '#fff' }}>Low Risk</option>
                </select>
              </div>
            </div>
          </div>

          {violations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
              <p style={{ color: 'var(--success)', fontWeight: '600' }}>
                No violations recorded for the current filters.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
              {violations.map(group => {
                const badgeColor = group.riskLevel === 'high' ? '#ef4444' : group.riskLevel === 'medium' ? '#f59e0b' : '#10b981';
                const badgeBg = group.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.12)' : group.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                
                return (
                  <div
                    key={group.student._id}
                    onClick={() => setSelectedStudentGroup(group)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1.25rem 1.75rem',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.background = 'var(--card-hover)';
                      e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = 'var(--surface-card)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ 
                        width: '44px', height: '44px', borderRadius: '14px', 
                        background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                        color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem', fontWeight: '700',
                        border: '1px solid var(--surface-border)'
                      }}>
                        {group.student.name.charAt(0)}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>{group.student.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{group.total} events</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.6 }}>•</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '500', cursor: 'pointer' }}>View Details</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '0.6rem 1.25rem', 
                      borderRadius: '12px', 
                      fontSize: '1.1rem', 
                      fontWeight: '800',
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeColor}20`,
                      minWidth: '50px',
                      textAlign: 'center'
                    }}>
                       {group.suspicionScore}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <FileText size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Student Results</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            className="btn-primary"
            onClick={handleDownloadAllReports}
            disabled={reportLoading || attempts.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: attempts.length === 0 ? 0.5 : 1 }}
          >
            Download All Reports 📦
          </button>
        </div>

        {attempts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No student attempts recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Student</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Exam</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Date</th>
                  <th style={{ padding: '1rem', fontWeight: '500', textAlign: 'right' }}>Score</th>
                  <th style={{ padding: '1rem', fontWeight: '500', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map(attempt => (
                  <tr key={attempt._id} style={{ 
                    borderBottom: '1px solid var(--surface-border)', 
                    transition: 'background 0.2s', 
                    background: attempt.is_disqualified ? (isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.03)') : 'transparent', 
                    borderLeft: attempt.is_disqualified ? '3px solid var(--danger)' : 'none' 
                  }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{attempt.student?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{attempt.student?.email || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>{attempt.exam?.title || 'Deleted Exam'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: attempt.is_disqualified ? 'rgba(239, 68, 68, 0.2)' : (attempt.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
                        color: attempt.is_disqualified ? 'var(--danger)' : (attempt.status === 'completed' ? 'var(--success)' : 'var(--warning)')
                      }}>
                        {attempt.is_disqualified ? 'DISQUALIFIED 🚫' : (attempt.status ? attempt.status.toUpperCase() : 'UNKNOWN')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(attempt.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', fontSize: '1.1rem' }}>
                      {attempt.is_disqualified
                        ? <span style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: '700', letterSpacing: '0.03em' }}>— N/A</span>
                        : <span style={{ color: 'var(--primary)' }}>{attempt.score}</span>
                      }
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button
                        onClick={(e) => handleDownloadReport(e, attempt.student._id, attempt.exam._id)}
                        disabled={reportLoading}
                        style={{
                          background: 'rgba(13, 148, 136, 0.1)', border: '1px solid var(--primary)',
                          color: 'var(--primary)', padding: '0.4rem 0.8rem', borderRadius: '6px',
                          fontSize: '0.8rem', cursor: reportLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Download Report 📄
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Student Violation Modal */}
      {selectedStudentGroup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '700px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            animation: 'popupScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>{selectedStudentGroup.student.name}</h2>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedStudentGroup.student.email}{selectedExamId !== 'all' ? ` • Filtered by exam` : ''}</div>
              </div>
              <button
                onClick={() => setSelectedStudentGroup(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '2rem', cursor: 'pointer', padding: '0 0.5rem' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: selectedStudentGroup.riskBg, border: `1px solid ${selectedStudentGroup.riskColor}40`, padding: '1rem', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: selectedStudentGroup.riskColor }}>{selectedStudentGroup.suspicionScore}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '700', marginTop: '0.25rem' }}>Suspicion Score</div>
                  <div style={{ fontSize: '0.75rem', color: selectedStudentGroup.riskColor, marginTop: '0.25rem', fontWeight: '600' }}>{selectedStudentGroup.riskLabel}</div>
                </div>
                <div style={{ background: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.1)'}`, padding: '1rem', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger)' }}>{selectedStudentGroup.total}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>Total 🚨</div>
                </div>
                <div style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: '1px solid var(--surface-border)', padding: '1rem', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{selectedStudentGroup.tab}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Tab Switches 🚫</div>
                </div>
                <div style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: '1px solid var(--surface-border)', padding: '1rem', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{selectedStudentGroup.fullscreen}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Fullscreen ⚠️</div>
                </div>
              </div>

              {/* ═══ Activity Timeline Panel ═══ */}
              <ActivityTimeline history={selectedStudentGroup.history} />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminDashboard;
