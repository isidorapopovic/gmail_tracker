import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

export const checkAuth = () => api.get("/auth/status");
export const loginWithGoogle = () => { window.location.href = "/api/auth/google"; };
export const logout = () => api.post("/auth/logout");

export const syncEmails = () => api.post("/sync");
export const getJobs = () => api.get("/jobs");
export const getStats = () => api.get("/stats");

export const updateNotes = (id, notes) => api.patch(`/jobs/${id}/notes`, { notes });
export const updateStatus = (id, status) => api.patch(`/jobs/${id}/status`, { status });
export const deleteJob = (id) => api.delete(`/jobs/${id}`);

export default api;
