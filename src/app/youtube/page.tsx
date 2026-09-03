'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Mic,
  Video,
  Bell,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  MessageSquare,
  CheckCircle,
  X,
  Play,
  ArrowLeft,
  Sparkles,
  MoreVertical,
  Flame,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserNav from '../../components/UserNav';
import { useLocale } from '../../context/LocaleContext';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  channelAvatar: string;
  subscribers: string;
  views: string;
  timestamp: string;
  duration: string;
  category: string;
  thumbnail: string;
  description: string;
  likes: number;
  isLiked?: boolean;
  isDisliked?: boolean;
  isSaved?: boolean;
  isSubscribed?: boolean;
  comments: Comment[];
}

const INITIAL_VIDEOS: VideoItem[] = [
  {
    id: 'v1',
    youtubeId: 'cbKkB3OKOOY',
    title: '20 MIN FULL BODY WORKOUT - No Equipment & No Noise!',
    channel: 'MadFit',
    channelAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    subscribers: '8.45M',
    views: '12M views',
    timestamp: '2 years ago',
    duration: '20:15',
    category: 'Full Body',
    thumbnail: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    description: 'A 20 minute full body workout that requires NO equipment and is apartment friendly (no jumping)! Perfect for burning calories and tone your whole body.',
    likes: 452000,
    isSubscribed: false,
    comments: [
      { id: 'c1', author: 'Alex Turner', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80', text: 'This workout saved my routine! Done it 3 times this week.', timestamp: '3 months ago', likes: 1240 },
      { id: 'c2', author: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80', text: 'No noise jumping is a blessing when living on the 3rd floor!', timestamp: '1 month ago', likes: 856 },
    ]
  },
  {
    id: 'v2',
    youtubeId: 'ml6cT4AZdqI',
    title: '10 MIN PERFECT ABS WORKOUT (Six Pack Guaranteed)',
    channel: 'ATHLEAN-X',
    channelAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    subscribers: '13.8M',
    views: '45M views',
    timestamp: '3 years ago',
    duration: '10:48',
    category: 'Fat Loss',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80',
    description: 'If you want to get six pack abs, you need to follow a complete ab workout that hits all parts of your core. Jeff Cavaliere shows you the science-backed 10 min routine.',
    likes: 1200000,
    isSubscribed: true,
    comments: [
      { id: 'c3', author: 'Marcus Vance', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=80&q=80', text: 'Jeff taught me more about anatomy in 10 minutes than 4 years of high school.', timestamp: '1 year ago', likes: 4320 },
    ]
  },
  {
    id: 'v3',
    youtubeId: 'gC_L9qAHVJ8',
    title: '15 Min Daily Morning Yoga Routine for Beginners',
    channel: 'Yoga With Adriene',
    channelAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
    subscribers: '12.2M',
    views: '18M views',
    timestamp: '1 year ago',
    duration: '15:30',
    category: 'Yoga',
    thumbnail: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80',
    description: 'Start your morning right with this gentle 15 minute wake up flow. Great for opening hips, stretching spine and increasing energy for the day ahead.',
    likes: 680000,
    comments: [
      { id: 'c4', author: 'Elena Rostova', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80', text: 'Benny in the background makes every morning better!', timestamp: '5 months ago', likes: 920 },
    ]
  },
  {
    id: 'v4',
    youtubeId: 'v7AYKMP6rOE',
    title: 'How To Meal Prep High Protein Meals For Weight Loss (Cheap & Fast)',
    channel: 'Pro Home Cooks',
    channelAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
    subscribers: '3.6M',
    views: '4.2M views',
    timestamp: '8 months ago',
    duration: '14:22',
    category: 'Meal Prep',
    thumbnail: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80',
    description: 'Learn how to meal prep 15 high-protein, low calorie meals in under 1 hour for under $30. Complete macro breakdown included for each portion!',
    likes: 215000,
    comments: [
      { id: 'c5', author: 'David Kim', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=80&q=80', text: 'The chicken marinade recipe is absolutely game changing.', timestamp: '2 months ago', likes: 310 },
    ]
  },
  {
    id: 'v5',
    youtubeId: '2pLT-olgUJs',
    title: 'Build Muscle at Home with Calisthenics (Full Guide)',
    channel: 'Chris Heria',
    channelAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&q=80',
    subscribers: '4.9M',
    views: '9.8M views',
    timestamp: '1 year ago',
    duration: '12:05',
    category: 'Calisthenics',
    thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80',
    description: 'Want to build real functional muscle using only bodyweight? Check out this complete breakdown of pushups, pullups, dips, and core progressions.',
    likes: 530000,
    comments: [
      { id: 'c6', author: 'Lucas Miller', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=80&q=80', text: 'Started doing these progressions 6 months ago, best shape of my life!', timestamp: '4 months ago', likes: 710 },
    ]
  },
  {
    id: 'v6',
    youtubeId: 'I1C2aM8QYp0',
    title: '30 MIN HIGH INTENSITY CARDIO BURN (Fat Loss HIIT)',
    channel: 'Growingannanas',
    channelAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
    subscribers: '5.1M',
    views: '15M views',
    timestamp: '1 year ago',
    duration: '31:10',
    category: 'HIIT',
    thumbnail: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    description: 'Get ready to sweat! Intense 30 min HIIT workout with no equipment to blast calories and boost endurance. Includes music and timer.',
    likes: 890000,
    comments: [
      { id: 'c7', author: 'Chloe Bennett', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80', text: 'I am completely soaked with sweat, Anna is a beast!', timestamp: '6 months ago', likes: 1150 },
    ]
  }
];

const CATEGORIES = [
  'All',
  'Full Body',
  'Fat Loss',
  'Muscle Building',
  'Meal Prep',
  'HIIT',
  'Yoga',
  'Calisthenics',
  'Motivation'
];

export default function YouTubeCopyPage() {
  const { user } = useAuth();
  const { profile } = useApp();
  const { t } = useLocale();

  const [videos, setVideos] = useState<VideoItem[]>(INITIAL_VIDEOS);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');

  const activeVideo = useMemo(() => {
    return videos.find((v) => v.id === activeVideoId) || null;
  }, [videos, activeVideoId]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchCat = selectedCategory === 'All' || v.category === selectedCategory;
      const matchSearch =
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [videos, selectedCategory, searchQuery]);

  const handleToggleLike = (videoId: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== videoId) return v;
        const isLiked = !v.isLiked;
        return {
          ...v,
          isLiked,
          isDisliked: false,
          likes: isLiked ? v.likes + 1 : v.likes - 1,
        };
      })
    );
  };

  const handleToggleDislike = (videoId: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== videoId) return v;
        const isDisliked = !v.isDisliked;
        return {
          ...v,
          isDisliked,
          isLiked: false,
          likes: v.isLiked ? v.likes - 1 : v.likes,
        };
      })
    );
  };

  const handleToggleSubscribe = (videoId: string) => {
    setVideos((prev) => {
      const target = prev.find((item) => item.id === videoId);
      if (!target) return prev;
      const targetChannel = target.channel;
      const newSubStatus = !target.isSubscribed;
      return prev.map((v) => (v.channel === targetChannel ? { ...v, isSubscribed: newSubStatus } : v));
    });
  };

  const handleAddComment = () => {
    if (!activeVideo || !newCommentText.trim()) return;
    const authorName = profile?.username || user?.email?.split('@')[0] || 'Fitness Enthusiast';
    const newComment: Comment = {
      id: 'c_' + Date.now(),
      author: authorName,
      avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80',
      text: newCommentText.trim(),
      timestamp: 'Just now',
      likes: 0,
    };

    setVideos((prev) =>
      prev.map((v) => (v.id === activeVideo.id ? { ...v, comments: [newComment, ...v.comments] } : v))
    );
    setNewCommentText('');
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pb-28">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/10 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveVideoId(null)}
            className="flex items-center gap-1.5 focus:outline-none group"
          >
            <div className="w-9 h-6 bg-red-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Play size={14} className="fill-white text-white ml-0.5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight font-sans text-white">
              YouTube<span className="text-xs font-normal text-red-500 ml-1 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">FIT</span>
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl mx-2 flex items-center">
          <div className="relative w-full flex items-center">
            <input
              type="text"
              placeholder="Search fitness, workouts, recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121212] border border-[#303030] focus:border-blue-500 rounded-l-full py-2 pl-4 pr-9 text-sm text-white placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="bg-[#222222] border border-l-0 border-[#303030] hover:bg-[#272727] px-4 py-2 rounded-r-full text-gray-300 flex items-center justify-center shrink-0"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            className="ml-2 hidden sm:flex bg-[#222222] hover:bg-[#272727] p-2.5 rounded-full text-white shrink-0"
            title="Search with voice"
          >
            <Mic size={18} />
          </button>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="p-2 hover:bg-white/10 rounded-full text-gray-200 hidden sm:block"
            title="Create video"
          >
            <Video size={20} />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-white/10 rounded-full text-gray-200 relative"
            title="Notifications"
          >
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <UserNav />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 pt-3">
        {/* Category Pills Bar (when video player is not active) */}
        {!activeVideo && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2 scrollbar-none snap-x">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`snap-center shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'bg-[#272727] text-gray-200 hover:bg-[#3f3f3f]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* VIDEO PLAYER VIEW */}
        <AnimatePresence mode="wait">
          {activeVideo ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left Column: Player & Video Info */}
              <div className="lg:col-span-2 space-y-4">
                <button
                  type="button"
                  onClick={() => setActiveVideoId(null)}
                  className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-1 transition-colors"
                >
                  <ArrowLeft size={18} /> Back to video list
                </button>

                {/* Embedded Player */}
                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <iframe
                    src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                    title={activeVideo.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Video Title & Actions */}
                <div className="space-y-3">
                  <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {activeVideo.title}
                  </h1>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    {/* Channel info & subscribe */}
                    <div className="flex items-center gap-3">
                      <img
                        src={activeVideo.channelAvatar}
                        alt={activeVideo.channel}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                      />
                      <div>
                        <div className="flex items-center gap-1 font-bold text-sm text-white">
                          {activeVideo.channel}
                          <CheckCircle size={14} className="text-gray-400 fill-gray-400" />
                        </div>
                        <p className="text-xs text-gray-400">{activeVideo.subscribers} subscribers</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSubscribe(activeVideo.id)}
                        className={`ml-2 px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          activeVideo.isSubscribed
                            ? 'bg-[#272727] text-white hover:bg-[#3f3f3f]'
                            : 'bg-white text-black hover:bg-gray-200'
                        }`}
                      >
                        {activeVideo.isSubscribed ? (
                          <>
                            <UserCheck size={14} /> Subscribed
                          </>
                        ) : (
                          <>
                            <UserPlus size={14} /> Subscribe
                          </>
                        )}
                      </button>
                    </div>

                    {/* Like / Dislike / Share / Save buttons */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                      <div className="flex items-center bg-[#272727] rounded-full overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleToggleLike(activeVideo.id)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold hover:bg-[#3f3f3f] transition-colors ${
                            activeVideo.isLiked ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          <ThumbsUp size={16} className={activeVideo.isLiked ? 'fill-blue-400' : ''} />
                          <span>{(activeVideo.likes / 1000).toFixed(1)}k</span>
                        </button>
                        <div className="w-[1px] h-5 bg-white/15" />
                        <button
                          type="button"
                          onClick={() => handleToggleDislike(activeVideo.id)}
                          className={`px-3 py-2 text-xs font-semibold hover:bg-[#3f3f3f] transition-colors ${
                            activeVideo.isDisliked ? 'text-red-400' : 'text-white'
                          }`}
                        >
                          <ThumbsDown size={16} className={activeVideo.isDisliked ? 'fill-red-400' : ''} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.share) {
                            void navigator.share({
                              title: activeVideo.title,
                              url: window.location.href,
                            });
                          } else {
                            void navigator.clipboard.writeText(window.location.href);
                            alert('Video URL copied to clipboard!');
                          }
                        }}
                        className="flex items-center gap-1.5 bg-[#272727] hover:bg-[#3f3f3f] px-3.5 py-2 rounded-full text-xs font-semibold text-white transition-colors"
                      >
                        <Share2 size={16} />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="bg-[#272727]/80 rounded-2xl p-3.5 text-xs text-gray-200 space-y-2 border border-white/5">
                    <div className="flex items-center gap-2 text-gray-300 font-bold">
                      <span>{activeVideo.views}</span>
                      <span>•</span>
                      <span>{activeVideo.timestamp}</span>
                      <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                        #{activeVideo.category}
                      </span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed text-gray-300">{activeVideo.description}</p>
                  </div>

                  {/* Comments Section */}
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={18} className="text-gray-300" />
                      <h3 className="font-bold text-base text-white">
                        {activeVideo.comments.length} Comments
                      </h3>
                    </div>

                    {/* Add Comment Input */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {user?.email ? user.email[0].toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Add a comment..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment();
                          }}
                          className="w-full bg-transparent border-b border-white/20 focus:border-white py-1 text-xs text-white focus:outline-none"
                        />
                        {newCommentText.trim() && (
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setNewCommentText('')}
                              className="px-3 py-1 rounded-full text-xs hover:bg-white/10 text-gray-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleAddComment}
                              className="px-3.5 py-1 rounded-full text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                            >
                              Comment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Comment List */}
                    <div className="space-y-4 pt-2">
                      {activeVideo.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 items-start">
                          <img
                            src={comment.avatar}
                            alt={comment.author}
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10"
                          />
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{comment.author}</span>
                              <span className="text-[10px] text-gray-400">{comment.timestamp}</span>
                            </div>
                            <p className="text-xs text-gray-200 break-words">{comment.text}</p>
                            <div className="flex items-center gap-3 pt-0.5 text-gray-400 text-xs">
                              <button
                                type="button"
                                className="flex items-center gap-1 hover:text-white"
                              >
                                <ThumbsUp size={12} />
                                <span className="text-[10px]">{comment.likes}</span>
                              </button>
                              <button type="button" className="hover:text-white">
                                <ThumbsDown size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Up Next Videos */}
              <div className="space-y-3">
                <h2 className="font-bold text-sm text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Flame size={16} className="text-amber-500" /> Up Next Fitness Videos
                </h2>
                <div className="space-y-3">
                  {videos
                    .filter((v) => v.id !== activeVideo.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setActiveVideoId(item.id)}
                        className="flex gap-2.5 cursor-pointer group hover:bg-[#272727]/60 p-2 rounded-xl transition-colors"
                      >
                        <div className="relative w-36 aspect-video bg-black rounded-lg overflow-hidden shrink-0 border border-white/10">
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {item.duration}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">{item.channel}</p>
                          <p className="text-[10px] text-gray-500">
                            {item.views} • {item.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* VIDEO GRID VIEW */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-y-6 gap-x-4"
            >
              {filteredVideos.length === 0 ? (
                <div className="col-span-full text-center py-16 text-gray-400 space-y-2">
                  <Sparkles size={32} className="mx-auto text-gray-500" />
                  <p className="font-medium text-base">No videos found</p>
                  <p className="text-xs">Try searching for a different topic or select another category.</p>
                </div>
              ) : (
                filteredVideos.map((video) => (
                  <motion.div
                    key={video.id}
                    layout
                    onClick={() => setActiveVideoId(video.id)}
                    className="group cursor-pointer space-y-2.5 bg-[#181818] rounded-2xl p-2.5 border border-white/5 hover:border-white/20 transition-all hover:shadow-xl"
                  >
                    {/* Video Thumbnail */}
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                        {video.duration}
                      </span>
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play size={20} className="fill-white text-white ml-1" />
                        </div>
                      </div>
                    </div>

                    {/* Video Metadata */}
                    <div className="flex gap-3 pt-0.5">
                      <img
                        src={video.channelAvatar}
                        alt={video.channel}
                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <span>{video.channel}</span>
                          <CheckCircle size={12} className="text-gray-400 fill-gray-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                          <span>{video.views}</span>
                          <span>•</span>
                          <span>{video.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
