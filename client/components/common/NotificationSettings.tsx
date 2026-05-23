"use client";

import { useState, useEffect } from "react";
import { X, Settings, Volume2, Bell, Smartphone, Mail, RotateCcw, Check } from "lucide-react";

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: NotificationSettings) => void;
}

interface NotificationSettings {
  // Real-time Toasts
  showToastCritical: boolean;
  showToastWarning: boolean;
  showToastInfo: boolean;
  toastPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  toastDuration: number;
  
  // Sound & Vibration
  soundCritical: boolean;
  soundWarning: boolean;
  soundInfo: boolean;
  vibrationCritical: boolean;
  vibrationWarning: boolean;
  
  // Alert Types
  overspeedSeverity: "critical" | "warning" | "info";
  overspeedChannels: string[];
  geofenceSeverity: "critical" | "warning" | "info";
  geofenceChannels: string[];
  ignitionSeverity: "critical" | "warning" | "info";
  ignitionChannels: string[];
  offlineSeverity: "critical" | "warning" | "info";
  offlineChannels: string[];
  sosSeverity: "critical" | "warning" | "info";
  sosChannels: string[];
  
  // Notification Center
  groupSimilarAlerts: boolean;
  groupTimeWindow: number;
  autoResolveInfo: boolean;
  autoResolveTime: number;
  showUnreadCount: boolean;
  desktopNotifications: boolean;
  
  // Advanced (Admin Only)
  enableEscalation: boolean;
  sendSMS: boolean;
  forwardEmail: boolean;
  webhookIntegration: boolean;
}

const defaultSettings: NotificationSettings = {
  showToastCritical: true,
  showToastWarning: true,
  showToastInfo: false,
  toastPosition: "bottom-right",
  toastDuration: 5000,
  
  soundCritical: true,
  soundWarning: false,
  soundInfo: false,
  vibrationCritical: true,
  vibrationWarning: false,
  
  overspeedSeverity: "critical",
  overspeedChannels: ["toast", "email"],
  geofenceSeverity: "warning",
  geofenceChannels: ["toast"],
  ignitionSeverity: "info",
  ignitionChannels: ["silent"],
  offlineSeverity: "warning",
  offlineChannels: ["email", "sms"],
  sosSeverity: "critical",
  sosChannels: ["toast", "email", "sms", "push"],
  
  groupSimilarAlerts: true,
  groupTimeWindow: 5,
  autoResolveInfo: true,
  autoResolveTime: 24,
  showUnreadCount: true,
  desktopNotifications: true,
  
  enableEscalation: false,
  sendSMS: false,
  forwardEmail: false,
  webhookIntegration: false,
};

export function NotificationSettings({ isOpen, onClose, onSave }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<"toasts" | "sounds" | "alerts" | "center" | "advanced">("toasts");

  // Add ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateChannelSetting = (alertType: keyof NotificationSettings, channel: string) => {
    const currentChannels = settings[alertType] as string[];
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];
    updateSetting(alertType, newChannels);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <div 
          className="w-full h-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: "toasts", label: "Real-time Toasts", icon: Bell },
            { id: "sounds", label: "Sound & Vibration", icon: Volume2 },
            { id: "alerts", label: "Alert Types", icon: Settings },
            { id: "center", label: "Notification Center", icon: Bell },
            { id: "advanced", label: "Advanced", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Real-time Toasts Tab */}
          {activeTab === "toasts" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Toast Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Show toast for Critical alerts (Always)</span>
                    <input
                      type="checkbox"
                      checked={settings.showToastCritical}
                      onChange={(e) => updateSetting("showToastCritical", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Show toast for Warning alerts (Limit: 3/hour)</span>
                    <input
                      type="checkbox"
                      checked={settings.showToastWarning}
                      onChange={(e) => updateSetting("showToastWarning", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Show toast for Info alerts (Silent only)</span>
                    <input
                      type="checkbox"
                      checked={settings.showToastInfo}
                      onChange={(e) => updateSetting("showToastInfo", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Toast Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Toast Position
                    </label>
                    <select
                      value={settings.toastPosition}
                      onChange={(e) => updateSetting("toastPosition", e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-right">Bottom Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (seconds)
                    </label>
                    <select
                      value={settings.toastDuration / 1000}
                      onChange={(e) => updateSetting("toastDuration", parseInt(e.target.value) * 1000)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="3">3s</option>
                      <option value="5">5s</option>
                      <option value="10">10s</option>
                      <option value="0">No auto-hide</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sound & Vibration Tab */}
          {activeTab === "sounds" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sound Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Critical: Sound + Vibration</span>
                    <input
                      type="checkbox"
                      checked={settings.soundCritical}
                      onChange={(e) => updateSetting("soundCritical", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Warning: Sound only</span>
                    <input
                      type="checkbox"
                      checked={settings.soundWarning}
                      onChange={(e) => updateSetting("soundWarning", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Info: Silent</span>
                    <input
                      type="checkbox"
                      checked={settings.soundInfo}
                      onChange={(e) => updateSetting("soundInfo", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vibration Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Critical: Vibration</span>
                    <input
                      type="checkbox"
                      checked={settings.vibrationCritical}
                      onChange={(e) => updateSetting("vibrationCritical", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Warning: Vibration</span>
                    <input
                      type="checkbox"
                      checked={settings.vibrationWarning}
                      onChange={(e) => updateSetting("vibrationWarning", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Sound</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Volume2 size={16} />
                  Test Sound
                </button>
              </div>
            </div>
          )}

          {/* Alert Types Tab */}
          {activeTab === "alerts" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Configuration</h3>
                <div className="space-y-4">
                  {/* Overspeed */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">🚨 OVERSPEED</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                        <select
                          value={settings.overspeedSeverity}
                          onChange={(e) => updateSetting("overspeedSeverity", e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="critical">Critical</option>
                          <option value="warning">Warning</option>
                          <option value="info">Info</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Channels</label>
                        <div className="space-y-2">
                          {["toast", "email", "sms", "push"].map((channel) => (
                            <label key={channel} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={(settings.overspeedChannels as string[]).includes(channel)}
                                onChange={() => updateChannelSetting("overspeedChannels", channel)}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <span className="text-sm capitalize">{channel}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Geofence */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">🔔 GEOFENCE</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                        <select
                          value={settings.geofenceSeverity}
                          onChange={(e) => updateSetting("geofenceSeverity", e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="critical">Critical</option>
                          <option value="warning">Warning</option>
                          <option value="info">Info</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Channels</label>
                        <div className="space-y-2">
                          {["toast", "email", "sms", "push"].map((channel) => (
                            <label key={channel} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={(settings.geofenceChannels as string[]).includes(channel)}
                                onChange={() => updateChannelSetting("geofenceChannels", channel)}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <span className="text-sm capitalize">{channel}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ignition */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">🔥 IGNITION</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                        <select
                          value={settings.ignitionSeverity}
                          onChange={(e) => updateSetting("ignitionSeverity", e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="critical">Critical</option>
                          <option value="warning">Warning</option>
                          <option value="info">Info</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Channels</label>
                        <div className="space-y-2">
                          {["toast", "email", "sms", "push", "silent"].map((channel) => (
                            <label key={channel} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={(settings.ignitionChannels as string[]).includes(channel)}
                                onChange={() => updateChannelSetting("ignitionChannels", channel)}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <span className="text-sm capitalize">{channel}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Center Tab */}
          {activeTab === "center" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Center Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Group similar alerts (Time window: {settings.groupTimeWindow} min)</span>
                    <input
                      type="checkbox"
                      checked={settings.groupSimilarAlerts}
                      onChange={(e) => updateSetting("groupSimilarAlerts", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grouping Time Window</label>
                    <select
                      value={settings.groupTimeWindow}
                      onChange={(e) => updateSetting("groupTimeWindow", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">1 minute</option>
                      <option value="5">5 minutes</option>
                      <option value="10">10 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Auto-resolve info alerts after {settings.autoResolveTime}h</span>
                    <input
                      type="checkbox"
                      checked={settings.autoResolveInfo}
                      onChange={(e) => updateSetting("autoResolveInfo", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Auto-resolve Time</label>
                    <select
                      value={settings.autoResolveTime}
                      onChange={(e) => updateSetting("autoResolveTime", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">1 hour</option>
                      <option value="6">6 hours</option>
                      <option value="12">12 hours</option>
                      <option value="24">24 hours</option>
                      <option value="48">48 hours</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Show unread count on bell icon</span>
                    <input
                      type="checkbox"
                      checked={settings.showUnreadCount}
                      onChange={(e) => updateSetting("showUnreadCount", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Desktop notifications when tab inactive</span>
                    <input
                      type="checkbox"
                      checked={settings.desktopNotifications}
                      onChange={(e) => updateSetting("desktopNotifications", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === "advanced" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced: Admin Only</h3>
                <p className="text-sm text-gray-600 mb-4">These settings require administrator privileges</p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Enable escalation rules</span>
                    <input
                      type="checkbox"
                      checked={settings.enableEscalation}
                      onChange={(e) => updateSetting("enableEscalation", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Send SMS for critical alerts</span>
                    <input
                      type="checkbox"
                      checked={settings.sendSMS}
                      onChange={(e) => updateSetting("sendSMS", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Forward to email group</span>
                    <input
                      type="checkbox"
                      checked={settings.forwardEmail}
                      onChange={(e) => updateSetting("forwardEmail", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Webhook integration for alerts</span>
                    <input
                      type="checkbox"
                      checked={settings.webhookIntegration}
                      onChange={(e) => updateSetting("webhookIntegration", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <RotateCcw size={16} />
            Reset Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check size={16} />
              Save Changes
            </button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
