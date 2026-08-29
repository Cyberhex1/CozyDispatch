import React from 'react';
import { NotificationAlert, Game } from '../types';
import { 
  Bell, 
  Check, 
  TrendingDown, 
  Sparkles, 
  Clock, 
  ExternalLink, 
  Trash2, 
  CheckCheck,
  Percent,
  X
} from 'lucide-react';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationAlert[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectGameById?: (gameId: string) => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectGameById
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#FDFBF7] rounded-2xl border border-[#E6E2D3] shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="px-4 py-3 bg-[#F5F5F0] border-b border-[#E6E2D3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#8BA888]" />
          <h3 className="font-serif-natural text-sm font-normal text-[#5A5A40]">
            Notifications & Alerts
          </h3>
          {unreadCount > 0 && (
            <span className="bg-[#E6A07D] text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[11px] font-bold text-[#8BA888] hover:text-[#7A9977] transition-colors cursor-pointer"
              title="Mark all as read"
            >
              Mark read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[#707060] hover:text-[#5A5A40] p-1 rounded-lg hover:bg-[#E6E2D3]/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#E6E2D3]/60">
        {notifications.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Bell className="w-8 h-8 text-[#8BA888] mx-auto opacity-40" />
            <p className="text-xs font-bold text-[#5A5A40]">No new notifications</p>
            <p className="text-[11px] text-[#707060]">
              You'll be alerted when your wishlisted PC games go on sale or release!
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                onMarkAsRead(notif.id);
                if (notif.gameId && onSelectGameById) {
                  onSelectGameById(notif.gameId);
                  onClose();
                }
              }}
              className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                !notif.isRead ? 'bg-[#EBF0EA]/60 hover:bg-[#EBF0EA]' : 'bg-[#FDFBF7] hover:bg-[#F5F5F0]'
              }`}
            >
              {/* Cover or Icon */}
              {notif.gameCover ? (
                <img
                  src={notif.gameCover}
                  alt={notif.gameTitle || 'Game'}
                  className="w-11 h-13 rounded-lg object-cover shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#8BA888]/20 flex items-center justify-center text-[#8BA888] shrink-0">
                  {notif.type === 'sale' ? <TrendingDown className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
              )}

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[#5A5A40] line-clamp-1">
                    {notif.title}
                  </span>
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#E6A07D] shrink-0" />
                  )}
                </div>

                <p className="text-[11px] text-[#707060] line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#8BA888] font-medium pt-0.5">
                  <span>{notif.timestamp}</span>
                  {notif.discountPercent && (
                    <span className="bg-[#E6A07D] text-white font-bold px-1.5 py-0.2 rounded-full">
                      -{notif.discountPercent}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-2.5 bg-[#F5F5F0] border-t border-[#E6E2D3] flex items-center justify-between">
          <button
            onClick={onClearAll}
            className="text-[11px] text-[#707060] hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear alerts</span>
          </button>
          <span className="text-[10px] text-[#707060]">
            Synced with your PC Wishlist
          </span>
        </div>
      )}
    </div>
  );
};
