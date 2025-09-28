import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, FileText, Clock, Users } from 'lucide-react';
import { useDNAContext } from '../context/DNAContext';
import ProfilePicture from './ProfilePicture';
import apiService from '../services/apiService';

const SimpleStudentChat = ({
    selectedCloneId = null,
    onMessageRead = null,
    prePopulatedReplyText = '',
    onReplyTextUsed = null
}) => {
    const { currentUser } = useDNAContext();

    // States
    const [discussions, setDiscussions] = useState([]);
    const [selectedDiscussion, setSelectedDiscussion] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef(null);

    // Load discussions on mount
    useEffect(() => {
        if (currentUser?.id) {
            loadDiscussions();
        }
    }, [currentUser?.id]);

    // Auto-select discussion if selectedCloneId is provided
    useEffect(() => {
        if (selectedCloneId && discussions.length > 0) {
            const targetDiscussion = discussions.find(d =>
                d.cloneId === selectedCloneId ||
                (selectedCloneId === 'general' && !d.cloneId)
            );
            if (targetDiscussion) {
                selectDiscussion(targetDiscussion);
            }
        }
    }, [selectedCloneId, discussions]);

    // Handle pre-populated reply text
    useEffect(() => {
        if (prePopulatedReplyText) {
            setNewMessage(prePopulatedReplyText);
            // Notify parent that reply text was used
            if (onReplyTextUsed) {
                onReplyTextUsed();
            }
        }
    }, [prePopulatedReplyText, onReplyTextUsed]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const loadDiscussions = async () => {
        try {
            setLoading(true);
            const data = await apiService.get(`/clone-discussions/student/${currentUser.id}`);
            //console.log('Loaded discussions:', data);
            setDiscussions(data);
        } catch (error) {
            console.error('Error loading discussions:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectDiscussion = async (discussion) => {
        //console.log('Selecting discussion:', discussion.id);

        setSelectedDiscussion(discussion);
        setLoadingMessages(true);

        try {
            // Load messages for this discussion
            const response = await apiService.get(`/clone-discussions/${discussion.id}/messages`);
            setMessages(response.messages || []);

            // Mark as read if there are unread messages
            if (discussion.unreadCount > 0) {
                await apiService.patch(`/clone-discussions/${discussion.id}/mark-read`, {
                    userId: currentUser.id
                });

                // Update local state
                setDiscussions(prev => prev.map(d =>
                    d.id === discussion.id ? { ...d, unreadCount: 0 } : d
                ));

                // Notify parent
                if (onMessageRead) {
                    onMessageRead();
                }
            }
        } catch (error) {
            console.error('Error loading messages or marking as read:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedDiscussion || sending) return;

        setSending(true);
        try {
            const message = await apiService.post(`/clone-discussions/${selectedDiscussion.id}/messages`, {
                senderId: currentUser.id,
                content: newMessage.trim(),
                messageType: 'message'
            });

            // Add to local messages
            setMessages(prev => [...prev, message]);

            // Update discussion in list
            setDiscussions(prev => prev.map(d =>
                d.id === selectedDiscussion.id
                    ? { ...d, lastMessageAt: new Date().toISOString(), messageCount: (d.messageCount || 0) + 1 }
                    : d
            ));

            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
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

    const getDiscussionTitle = (discussion) => {
        if (discussion.clone?.cloneName) return discussion.clone.cloneName;
        if (discussion.practiceClone?.cloneName) return discussion.practiceClone.cloneName;
        return 'General Discussion';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[800px] max-h-[800px] bg-gray-50 rounded-xl">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-medium">Loading your discussions...</p>
                    <p className="text-gray-500 text-sm mt-1">This might take a moment</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[800px] max-h-[800px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex">
            {/* Left Panel - Discussions */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50 h-full">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-blue-600 text-white">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Your Discussions</h3>
                            <p className="text-blue-100 text-sm">
                                {discussions.length} conversation{discussions.length !== 1 ? 's' : ''} with instructors
                            </p>
                        </div>
                    </div>
                </div>

                {/* Discussions List */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {discussions.length === 0 ? (
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageCircle className="w-8 h-8 text-blue-600" />
                            </div>
                            <h4 className="text-gray-900 font-medium mb-2">No discussions yet</h4>
                            <p className="text-gray-500 text-sm">
                                Discussions will appear here when you message your instructors
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 p-3">
                            {discussions.map((discussion) => (
                                <div
                                    key={discussion.id}
                                    onClick={() => selectDiscussion(discussion)}
                                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${selectedDiscussion?.id === discussion.id
                                        ? 'bg-blue-50 border-2 border-blue-200 shadow-md'
                                        : 'hover:bg-white border-2 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${discussion.clone || discussion.practiceClone
                                                ? 'bg-emerald-100'
                                                : 'bg-purple-100'
                                                }`}>
                                                {discussion.clone || discussion.practiceClone ? (
                                                    <FileText className="w-5 h-5 text-emerald-600" />
                                                ) : (
                                                    <MessageCircle className="w-5 h-5 text-purple-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">
                                                    {getDiscussionTitle(discussion)}
                                                </p>
                                                <div className="flex items-center space-x-1 mt-1">
                                                    <Users className="w-3 h-3 text-gray-400" />
                                                    <p className="text-xs text-gray-500">with Instructors</p>
                                                </div>
                                            </div>
                                        </div>
                                        {discussion.unreadCount > 0 && (
                                            <div className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium shadow-lg">
                                                {discussion.unreadCount}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {discussion.lastMessage && (
                                            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                                {discussion.lastMessage.content}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <div className="flex items-center space-x-1">
                                                <MessageCircle className="w-3 h-3" />
                                                <span>{discussion.messageCount || 0} message{discussion.messageCount !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{formatDate(discussion.lastMessageAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Messages */}
            <div className="flex-1 flex flex-col h-full">

                {selectedDiscussion ? (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200 bg-indigo-600 text-white">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center">
                                    {selectedDiscussion.clone || selectedDiscussion.practiceClone ? (
                                        <FileText className="w-6 h-6" />
                                    ) : (
                                        <MessageCircle className="w-6 h-6" />
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg">
                                        {getDiscussionTitle(selectedDiscussion)}
                                    </h4>
                                    <p className="text-indigo-100 text-sm">Real-time discussion with your instructors</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 min-h-0">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                        <p className="text-gray-600 font-medium">Loading messages...</p>
                                    </div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center max-w-sm">
                                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <MessageCircle className="w-8 h-8 text-indigo-600" />
                                        </div>
                                        <h4 className="text-gray-900 font-medium mb-2">Start the conversation!</h4>
                                        <p className="text-gray-500 text-sm">
                                            Send your first message to begin discussing this topic with your instructors.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {/* Add profile picture for non-current user messages */}
                                        {message.sender.id !== currentUser.id && (
                                            <ProfilePicture
                                                src={message.sender.profilePicture}
                                                name={message.sender.name}
                                                size="lg"
                                                className="mr-3 mt-1 flex-shrink-0"
                                            />
                                        )}
                                        <div className={`max-w-2xl rounded-2xl p-4 shadow-sm ${message.sender.id === currentUser.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-900 border border-gray-200'
                                            }`}>
                                            <div className="flex items-center space-x-2 mb-2">
                                                <span className={`text-xs font-medium ${message.sender.id === currentUser.id ? 'text-blue-100' : 'text-gray-600'
                                                    }`}>
                                                    {message.sender.id === currentUser.id ? 'You' : message.sender.name}
                                                </span>
                                                <span className={`text-xs ${message.sender.id === currentUser.id ? 'text-blue-200' : 'text-gray-400'
                                                    }`}>
                                                    {formatFullDate(message.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-6 border-t border-gray-200 bg-white">
                            <div className="flex space-x-4">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-1 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                    rows={3}
                                    disabled={sending}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!newMessage.trim() || sending}
                                    className="px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                                >
                                    {sending ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                    <span className="font-medium">Send</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
                        <div className="text-center max-w-md">
                            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <MessageCircle className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Welcome to Messages</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Select a discussion from the left to view your conversation history and send messages to your instructors.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimpleStudentChat;