import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Trash2, User, FileText, Clock, AlertTriangle, Search, Filter, ChevronDown } from 'lucide-react';
import { useDNAContext } from '../context/DNAContext';
import apiService from '../services/apiService';
import ProfilePicture from './ProfilePicture';
import { markDiscussionAsRead } from '../utils/discussionUtils';

const DirectorMessagesChat = ({ onMessageRead }) => {
    const { currentUser } = useDNAContext();
    const [discussions, setDiscussions] = useState([]);
    const [selectedDiscussion, setSelectedDiscussion] = useState(null);
    const [messages, setMessages] = useState([]); // Separate state for messages
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Filter and search states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'unread', 'active'
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'oldest', 'student'

    // Delete modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [discussionToDelete, setDiscussionToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const messagesEndRef = useRef(null);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Load all discussions for directors
    const loadDiscussions = useCallback(async () => {
        try {
            const discussionsData = await apiService.get('/clone-discussions/director');
            //console.log('Loaded discussions:', discussionsData.length);
            setDiscussions(discussionsData);
        } catch (error) {
            console.error('Error loading discussions:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDiscussions();
    }, [loadDiscussions]);

    // Load all messages for a specific discussion
    const loadMessages = async (discussionId) => {
        try {
            setLoadingMessages(true);
            const response = await apiService.get(`/clone-discussions/${discussionId}/messages`);
            setMessages(response.messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    };



    // Filter and sort discussions
    const filteredAndSortedDiscussions = React.useMemo(() => {
        let filtered = discussions;

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(discussion =>
                discussion.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                discussion.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (discussion.clone?.cloneName && discussion.clone.cloneName.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Apply status filter
        if (filterStatus === 'unread') {
            filtered = filtered.filter(discussion => discussion.unreadCount > 0);
        } else if (filterStatus === 'active') {
            filtered = filtered.filter(discussion => discussion.status === 'active');
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.lastMessageAt) - new Date(b.lastMessageAt);
                case 'student':
                    return a.student.name.localeCompare(b.student.name);
                case 'recent':
                default:
                    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
            }
        });

        return filtered;
    }, [discussions, searchTerm, filterStatus, sortBy]);

    // In both StudentMessagesChat.jsx and DirectorMessagesChat.jsx
    const selectDiscussion = async (discussion) => {
        setSelectedDiscussion(discussion);
        setMessages([]); // Clear previous messages

        // Load all messages for this discussion
        await loadMessages(discussion.id);

        // ALWAYS mark as read when opening (like WhatsApp/Slack)
        try {
            await markDiscussionAsRead(discussion.id, currentUser.id);

            // Update local state to show 0 unread
            setDiscussions(prev => prev.map(d =>
                d.id === discussion.id ? { ...d, unreadCount: 0 } : d
            ));

            // Refresh the dashboard count
            if (onMessageRead) {
                onMessageRead();
            }
        } catch (error) {
            console.error('Error marking discussion as read:', error);
        }
    };

    const sendReply = async () => {
        if (!replyText.trim() || !selectedDiscussion || sending) return;

        setSending(true);
        try {
            const newMessage = await apiService.post(`/clone-discussions/${selectedDiscussion.id}/messages`, {
                senderId: currentUser.id,
                content: replyText.trim(),
                messageType: 'message'
            });

            // Add new message to the end of messages
            setMessages(prev => [...prev, newMessage]);

            // Update discussions list
            setDiscussions(prev => prev.map(disc =>
                disc.id === selectedDiscussion.id
                    ? {
                        ...disc,
                        lastMessage: newMessage,
                        lastMessageAt: new Date().toISOString(),
                        messageCount: (disc.messageCount || 0) + 1
                    }
                    : disc
            ));

            setReplyText('');
        } catch (error) {
            console.error('Error sending reply:', error);
            alert('Failed to send reply. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleDeleteDiscussion = async () => {
        if (!discussionToDelete || deleting) return;

        // Add this check for currentUser
        if (!currentUser || !currentUser.id) {
            console.error('No current user available for delete operation');
            alert('User session not available. Please refresh and try again.');
            return;
        }

        console.log('=== FRONTEND DELETE DEBUG ===');
        console.log('Discussion to delete:', discussionToDelete.id);
        console.log('Current user:', currentUser);
        console.log('Current user ID:', currentUser.id, 'Type:', typeof currentUser.id);

        setDeleting(true);
        try {
            // Changed from request body to query parameter to match backend
            await apiService.delete(`/clone-discussions/${discussionToDelete.id}?requesterId=${currentUser.id}`);

            // Remove from local state
            setDiscussions(prev => prev.filter(d => d.id !== discussionToDelete.id));

            // Clear selection if this was the selected discussion
            if (selectedDiscussion && selectedDiscussion.id === discussionToDelete.id) {
                setSelectedDiscussion(null);
                setMessages([]);
            }

            setShowDeleteModal(false);
            setDiscussionToDelete(null);
        } catch (error) {
            console.error('Error deleting discussion:', error);
            alert('Failed to delete discussion. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const formatFullDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading discussions...</span>
            </div>
        );
    }

    return (
        <div className="h-[70vh] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex">
            {/* Left Sidebar - Discussion List */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
                {/* Header with filters - Fixed */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Student Discussions</h3>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by student or clone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex space-x-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            <option value="unread">Unread</option>
                            <option value="active">Active</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="recent">Recent</option>
                            <option value="oldest">Oldest</option>
                            <option value="student">Student Name</option>
                        </select>
                    </div>

                    <div className="text-xs text-gray-600 mt-2">
                        {filteredAndSortedDiscussions.length} discussion{filteredAndSortedDiscussions.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Discussion List - Fixed height with scroll */}
                <div className="flex-1 overflow-y-auto">
                    {filteredAndSortedDiscussions.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm">No discussions found</p>
                        </div>
                    ) : (
                        <div className="space-y-1 p-2">
                            {filteredAndSortedDiscussions.map((discussion) => (
                                <div
                                    key={discussion.id}
                                    onClick={() => selectDiscussion(discussion)}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedDiscussion?.id === discussion.id
                                        ? 'bg-blue-50 border border-blue-200'
                                        : 'hover:bg-gray-50 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <ProfilePicture
                                                src={discussion.student.profilePicture}
                                                name={discussion.student.name}
                                                size="md"
                                                className="flex-shrink-0"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 text-sm">{discussion.student.name}</p>
                                                <p className="text-xs text-gray-600">{discussion.student.school?.name}</p>
                                            </div>
                                        </div>
                                        {discussion.unreadCount > 0 && (
                                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                                {discussion.unreadCount}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-gray-800 line-clamp-1">
                                            {discussion.clone?.cloneName ||
                                                discussion.practiceClone?.cloneName ||
                                                'General Discussion'}
                                        </p>

                                        {discussion.lastMessage && (
                                            <p className="text-xs text-gray-600 line-clamp-2">
                                                {discussion.lastMessage.content}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>{discussion.messageCount || 0} message{discussion.messageCount !== 1 ? 's' : ''}</span>
                                            <span>{formatDate(discussion.lastMessageAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Side - Chat Area */}
            <div className="flex-1 flex flex-col">
                {selectedDiscussion ? (
                    <>
                        {/* Chat Header - Fixed */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{selectedDiscussion.student.name}</h4>
                                        <p className="text-sm text-gray-600">
                                            {selectedDiscussion.clone?.cloneName ||
                                                selectedDiscussion.practiceClone?.cloneName ||
                                                'General Discussion'}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setDiscussionToDelete(selectedDiscussion);
                                        setShowDeleteModal(true);
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete Discussion"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages - Fixed height with scroll */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="ml-3 text-gray-600">Loading messages...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-gray-500">
                                    <p>No messages yet in this discussion.</p>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div className={`flex ${message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'} items-start space-x-3`}>
                                        {/* Profile picture - show on left for others, on right for current user */}
                                        {message.sender.id !== currentUser.id && (
                                            <ProfilePicture
                                                src={message.sender.profilePicture}
                                                name={message.sender.name}
                                                size="lg"
                                                className="flex-shrink-0 mt-1"
                                            />
                                        )}

                                        <div className={`max-w-3/4 ${message.sender.id === currentUser.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-900'
                                            } rounded-lg p-3`}>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-xs font-medium opacity-75">
                                                    {message.sender.name}
                                                </span>
                                                <span className="text-xs opacity-50">
                                                    {formatFullDate(message.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                        </div>

                                        {/* Profile picture for current user - on the right */}
                                        {message.sender.id === currentUser.id && (
                                            <ProfilePicture
                                                src={message.sender.profilePicture}
                                                name={message.sender.name}
                                                size="sm"
                                                className="flex-shrink-0 mt-1"
                                            />
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Box - Fixed */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                            <div className="flex space-x-3">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Type your reply..."
                                    className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={3}
                                    disabled={sending}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendReply();
                                        }
                                    }}
                                />
                                <button
                                    onClick={sendReply}
                                    disabled={!replyText.trim() || sending}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {sending ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                    <span>Send</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Discussion Selected</h3>
                            <p className="text-gray-600">
                                Select a student discussion to view and reply to messages.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Discussion</h3>
                            </div>

                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete this discussion with{' '}
                                <strong>{discussionToDelete?.student.name}</strong>?
                                <br />
                                <span className="text-sm text-gray-500">
                                    This will permanently delete all {discussionToDelete?.messageCount || 0} messages and cannot be undone.
                                </span>
                            </p>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDiscussionToDelete(null);
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                    disabled={deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteDiscussion}
                                    disabled={deleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                                >
                                    {deleting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DirectorMessagesChat;