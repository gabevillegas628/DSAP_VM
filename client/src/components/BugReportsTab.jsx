// components/BugReportsTab.jsx
import React, { useState, useEffect } from 'react';
import { Bug, Clock, CheckCircle, AlertTriangle, User, Calendar, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import apiService from '../services/apiService';

const BugReportsTab = () => {
    const [bugReports, setBugReports] = useState([]);
    const [stats, setStats] = useState({ open: 0, inProgress: 0, highPriority: 0, total: 0 });
    const [filters, setFilters] = useState({ status: 'all', urgency: 'all' });
    const [sorting, setSorting] = useState({ sortBy: 'created', sortOrder: 'desc' });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);

    useEffect(() => {
        fetchBugReports();
        fetchStats();
    }, [filters, sorting]);

    const fetchBugReports = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.urgency !== 'all') params.append('urgency', filters.urgency);
            params.append('sortBy', sorting.sortBy);
            params.append('sortOrder', sorting.sortOrder);

            const data = await apiService.get(`/bug-reports?${params}`);
            setBugReports(data.bugReports || []);
        } catch (error) {
            console.error('Error fetching bug reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const data = await apiService.get('/bug-reports/stats');
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const updateStatus = async (id, status, resolution = null) => {
        try {
            setUpdating(id);
            await apiService.patch(`/bug-reports/${id}`, { status, resolution });
            await fetchBugReports();
            await fetchStats();
            setSelectedReport(null);
        } catch (error) {
            console.error('Error updating bug report:', error);
        } finally {
            setUpdating(null);
        }
    };

    const handleResolve = (report) => {
        const resolution = prompt('Resolution notes (optional):');
        if (resolution !== null) {
            updateStatus(report.id, 'resolved', resolution);
        }
    };

    const handleSortChange = (field) => {
        setSorting(prev => ({
            sortBy: field,
            sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortIcon = (field) => {
        if (sorting.sortBy !== field) {
            return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
        }
        return sorting.sortOrder === 'desc' 
            ? <ArrowDown className="w-4 h-4 text-indigo-600" />
            : <ArrowUp className="w-4 h-4 text-indigo-600" />;
    };

    const getSortLabel = (field) => {
        const labels = {
            created: 'Date',
            urgency: 'Priority',
            status: 'Status'
        };
        return labels[field] || field;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return 'bg-blue-100 text-blue-800';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getUrgencyColor = (urgency) => {
        switch (urgency) {
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-orange-100 text-orange-800';
            case 'low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const getBrowserInfo = (browserInfoString) => {
        try {
            return JSON.parse(browserInfoString || '{}');
        } catch {
            return {};
        }
    };

    return (
        <div className="space-y-6">
            {/* Header and Stats */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Bug Reports</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="flex items-center">
                                <Bug className="w-5 h-5 text-blue-600 mr-2" />
                                <div>
                                    <p className="text-sm text-blue-600">Open</p>
                                    <p className="text-lg font-semibold text-blue-900">{stats.open}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-lg">
                            <div className="flex items-center">
                                <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                                <div>
                                    <p className="text-sm text-yellow-600">In Progress</p>
                                    <p className="text-lg font-semibold text-yellow-900">{stats.inProgress}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                            <div className="flex items-center">
                                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                                <div>
                                    <p className="text-sm text-red-600">High Priority</p>
                                    <p className="text-lg font-semibold text-red-900">{stats.highPriority}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center">
                                <CheckCircle className="w-5 h-5 text-gray-600 mr-2" />
                                <div>
                                    <p className="text-sm text-gray-600">Total</p>
                                    <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Sorting */}
                <div className="flex flex-col space-y-2">
                    <div className="flex space-x-3">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                        <select
                            value={filters.urgency}
                            onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                        >
                            <option value="all">All Priorities</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Sort:</span>
                        {['created', 'urgency', 'status'].map(field => (
                            <button
                                key={field}
                                onClick={() => handleSortChange(field)}
                                className={`flex items-center space-x-1 px-2 py-1 rounded text-sm transition-colors ${
                                    sorting.sortBy === field 
                                        ? 'bg-indigo-100 text-indigo-700' 
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                <span>{getSortLabel(field)}</span>
                                {getSortIcon(field)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bug Reports List */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="mt-2 text-gray-600">Loading bug reports...</p>
                </div>
            ) : bugReports.length === 0 ? (
                <div className="text-center py-8">
                    <Bug className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No bug reports found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {bugReports.map(report => {
                        const browserInfo = getBrowserInfo(report.browserInfo);
                        return (
                            <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h4 className="font-medium text-gray-900">#{report.id}</h4>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(report.urgency)}`}>
                                                {report.urgency}
                                            </span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                                                {report.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                            <div className="flex items-center">
                                                <User className="w-4 h-4 mr-1" />
                                                {report.user.name} ({report.userRole})
                                            </div>
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-1" />
                                                {formatDate(report.createdAt)}
                                            </div>
                                            {browserInfo.url && (
                                                <div className="flex items-center">
                                                    <ExternalLink className="w-4 h-4 mr-1" />
                                                    <span className="truncate max-w-xs">{browserInfo.url}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex space-x-2 ml-4">
                                        {report.status === 'open' && (
                                            <button
                                                onClick={() => updateStatus(report.id, 'in_progress')}
                                                disabled={updating === report.id}
                                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {updating === report.id ? 'Updating...' : 'Start Working'}
                                            </button>
                                        )}
                                        {report.status === 'in_progress' && (
                                            <button
                                                onClick={() => handleResolve(report)}
                                                disabled={updating === report.id}
                                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                            >
                                                {updating === report.id ? 'Updating...' : 'Resolve'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
                                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                        >
                                            {selectedReport === report.id ? 'Hide Details' : 'View Details'}
                                        </button>
                                    </div>
                                </div>

                                <p className="text-gray-700 mb-2">{report.description}</p>

                                {selectedReport === report.id && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                                        {report.consoleOutput && (
                                            <div>
                                                <h5 className="font-medium text-gray-900 mb-1">Console Output:</h5>
                                                {(() => {
                                                    try {
                                                        const consoleData = JSON.parse(report.consoleOutput);
                                                        return (
                                                            <div className="space-y-2 text-sm">
                                                                {consoleData.recentErrors?.length > 0 && (
                                                                    <div className="bg-red-50 p-3 rounded border">
                                                                        <h6 className="font-medium text-red-800 mb-2">
                                                                            Recent Errors ({consoleData.recentErrors.length}):
                                                                        </h6>
                                                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                                                            {consoleData.recentErrors.map((error, idx) => (
                                                                                <div key={idx} className="text-red-700 font-mono text-xs bg-white p-2 rounded">
                                                                                    <div className="text-red-600">[{error.timestamp}] {error.type.toUpperCase()}</div>
                                                                                    <div className="whitespace-pre-wrap">{error.message}</div>
                                                                                    {error.stack && (
                                                                                        <details className="mt-1">
                                                                                            <summary className="cursor-pointer text-red-500">Stack trace</summary>
                                                                                            <pre className="mt-1 text-xs overflow-x-auto">{error.stack}</pre>
                                                                                        </details>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {consoleData.recentLogs?.length > 0 && (
                                                                    <div className="bg-yellow-50 p-3 rounded border">
                                                                        <h6 className="font-medium text-yellow-800 mb-2">
                                                                            Recent Warnings ({consoleData.recentLogs.length}):
                                                                        </h6>
                                                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                            {consoleData.recentLogs.map((log, idx) => (
                                                                                <div key={idx} className="text-yellow-700 font-mono text-xs bg-white p-2 rounded">
                                                                                    <div className="text-yellow-600">[{log.timestamp}] {log.type.toUpperCase()}</div>
                                                                                    <div className="whitespace-pre-wrap">{log.message}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="text-gray-600 text-xs">
                                                                    Total captured: {consoleData.errorCount || 0} errors, {consoleData.consoleLogCount || 0} warnings
                                                                </div>
                                                            </div>
                                                        );
                                                    } catch (e) {
                                                        return <p className="text-gray-500 text-sm">Console output available but could not be parsed</p>;
                                                    }
                                                })()}
                                            </div>
                                        )}
                                        
                                        {report.steps && (
                                            <div>
                                                <h5 className="font-medium text-gray-900 mb-1">Steps to Reproduce:</h5>
                                                <p className="text-gray-700 whitespace-pre-line">{report.steps}</p>
                                            </div>
                                        )}

                                        {report.resolution && (
                                            <div>
                                                <h5 className="font-medium text-gray-900 mb-1">Resolution:</h5>
                                                <p className="text-gray-700">{report.resolution}</p>
                                            </div>
                                        )}

                                        <div>
                                            <h5 className="font-medium text-gray-900 mb-1">Technical Details:</h5>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <p><strong>User Agent:</strong> {browserInfo.userAgent || 'Not available'}</p>
                                                <p><strong>Viewport:</strong> {browserInfo.viewport || 'Not available'}</p>
                                                <p><strong>Timestamp:</strong> {browserInfo.timestamp ? formatDate(browserInfo.timestamp) : 'Not available'}</p>
                                                {browserInfo.platform && <p><strong>Platform:</strong> {browserInfo.platform}</p>}
                                                {browserInfo.language && <p><strong>Language:</strong> {browserInfo.language}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BugReportsTab;