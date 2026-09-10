// Shared client-side utilities

// ===== CONFIGURATION — CHANGE THESE FOR YOUR COLLEGE =====
window.COLLEGE_LAT = 15.3647;  // College latitude
window.COLLEGE_LNG = 75.1240;  // College longitude
window.COLLEGE_NAME = "College Campus";

const API_BASE = "";

/**
 * Make an authenticated API call
 */
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem("busTrackerToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Get current user from localStorage
 */
function getCurrentUser() {
  return JSON.parse(localStorage.getItem("busTrackerUser")) || null;
}

/**
 * Get auth token from localStorage
 */
function getToken() {
  return localStorage.getItem("busTrackerToken") || null;
}

/**
 * Logout and redirect
 */
function logout(redirectTo = "/") {
  localStorage.removeItem("busTrackerToken");
  localStorage.removeItem("busTrackerUser");
  window.location.href = redirectTo;
}

/**
 * Check if user is authenticated, redirect if not
 */
function requireAuth(role = null) {
  const user = getCurrentUser();
  const token = getToken();

  if (!user || !token) {
    window.location.href = role ? `/login.html?role=${role}` : "/";
    return false;
  }

  if (role && user.role !== role) {
    const redirects = { DRIVER: "/driver/dashboard.html", ADMIN: "/admin/dashboard.html", STUDENT: "/student/dashboard.html" };
    window.location.href = redirects[user.role] || "/";
    return false;
  }

  return true;
}

/**
 * Show error message in an element
 */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.remove("hidden");
  }
}

/**
 * Hide error message in an element
 */
function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add("hidden");
}
