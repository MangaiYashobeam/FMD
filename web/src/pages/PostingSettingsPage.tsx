/**
 * Posting Settings Page
 * 
 * Glo3D-style interface for configuring Facebook Marketplace auto-posting
 * Features: Day selector, hours, frequency, limits, auto-renew, auto-repost
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  Grid,
  Divider,
  Alert,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Stack,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Schedule as ScheduleIcon,
  Loop as LoopIcon,
  TrendingUp as TrendingUpIcon,
  Save as SaveIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import api from '../lib/api';

interface PostingSettings {
  // Schedule
  postOnSunday: boolean;
  postOnMonday: boolean;
  postOnTuesday: boolean;
  postOnWednesday: boolean;
  postOnThursday: boolean;
  postOnFriday: boolean;
  postOnSaturday: boolean;
  postFromHour: number;
  postUntilHour: number;
  postIntervalMinutes: number;
  dailyPostLimit: number;
  
  // Options
  postingPriority: string;
  includeVideos: boolean;
  videoSource: string;
  conditionTemplate: string | null;
  
  // Location
  postingLocation: string | null;
  postingRadius: number;
  
  // Auto-renewal
  autoRenewEnabled: boolean;
  renewFrequencyDays: number;
  
  // Auto-repost
  autoRepostEnabled: boolean;
  repostFrequencyDays: number;
  
  // Price updates
  autoUpdatePrices: boolean;
  priceChangeThreshold: number;
  
  // Status
  isActive: boolean;
  postsToday: number;
  totalPosts: number;
  lastPostAt: string | null;
}

interface PostingStatus {
  stats: {
    totalVehicles: number;
    postedVehicles: number;
    unpostedVehicles: number;
    pendingTasks: number;
  };
  recentPosts: Array<{
    id: string;
    vehicle: string;
    stockNumber: string;
    status: string;
    postedAt: string;
    postUrl: string;
  }>;
}

const DAYS = [
  { key: 'postOnSunday', label: 'Sun' },
  { key: 'postOnMonday', label: 'Mon' },
  { key: 'postOnTuesday', label: 'Tue' },
  { key: 'postOnWednesday', label: 'Wed' },
  { key: 'postOnThursday', label: 'Thu' },
  { key: 'postOnFriday', label: 'Fri' },
  { key: 'postOnSaturday', label: 'Sat' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`,
}));

export default function PostingSettingsPage() {
  const [settings, setSettings] = useState<PostingSettings | null>(null);
  const [status, setStatus] = useState<PostingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/posting/settings');
      setSettings(response.data.data.settings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load posting settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/posting/status');
      setStatus(response.data.data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      await api.put('/posting/settings', settings);
      toast.success('Posting settings saved!');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!settings) return;
    
    try {
      if (settings.isActive) {
        await api.post('/posting/pause');
        toast.success('Auto-posting paused');
      } else {
        await api.post('/posting/resume');
        toast.success('Auto-posting resumed!');
      }
      setSettings({ ...settings, isActive: !settings.isActive });
    } catch (error) {
      console.error('Failed to toggle posting:', error);
      toast.error('Failed to update posting status');
    }
  };

  const triggerManualPost = async () => {
    try {
      const response = await api.post('/posting/trigger');
      toast.success(`Posting queued: ${response.data.data.vehicle.title}`);
      fetchStatus();
    } catch (error: any) {
      console.error('Failed to trigger post:', error);
      toast.error(error.response?.data?.error || 'Failed to trigger post');
    }
  };

  const updateSetting = <K extends keyof PostingSettings>(key: K, value: PostingSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!settings) {
    return (
      <Alert severity="error">Failed to load settings. Please refresh the page.</Alert>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Auto-Posting Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure automatic Facebook Marketplace posting like Glo3D
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color={settings.isActive ? 'warning' : 'success'}
            startIcon={settings.isActive ? <PauseIcon /> : <PlayIcon />}
            onClick={toggleActive}
            size="large"
          >
            {settings.isActive ? 'Pause Auto-Post' : 'Start Auto-Post'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={saveSettings}
            disabled={!hasChanges || saving}
            size="large"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Stack>
      </Box>

      {/* Status Banner */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          bgcolor: settings.isActive ? 'success.main' : 'grey.700',
          color: 'white',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={3}>
            <Typography variant="h6">
              Status: {settings.isActive ? '🟢 Active' : '⏸️ Paused'}
            </Typography>
            <Typography variant="body2">
              Posts today: {settings.postsToday} / {settings.dailyPostLimit || '∞'}
            </Typography>
          </Grid>
          {status && (
            <>
              <Grid item xs={6} md={2}>
                <Typography variant="h4">{status.stats.totalVehicles}</Typography>
                <Typography variant="body2">Total Vehicles</Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="h4">{status.stats.postedVehicles}</Typography>
                <Typography variant="body2">Posted</Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="h4">{status.stats.unpostedVehicles}</Typography>
                <Typography variant="body2">Ready to Post</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Button
                  variant="contained"
                  color="inherit"
                  onClick={triggerManualPost}
                  sx={{ color: settings.isActive ? 'success.dark' : 'grey.900' }}
                >
                  Post Next Vehicle Now
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Schedule Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Posting Schedule
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Day Selection */}
              <Typography variant="subtitle2" gutterBottom>
                Post On Days:
              </Typography>
              <Stack direction="row" spacing={1} mb={3} flexWrap="wrap">
                {DAYS.map((day) => (
                  <Chip
                    key={day.key}
                    label={day.label}
                    color={settings[day.key as keyof PostingSettings] ? 'primary' : 'default'}
                    onClick={() =>
                      updateSetting(
                        day.key as keyof PostingSettings,
                        !settings[day.key as keyof PostingSettings]
                      )
                    }
                    sx={{ cursor: 'pointer', mb: 1 }}
                  />
                ))}
              </Stack>

              {/* Hour Range */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>From</InputLabel>
                    <Select
                      value={settings.postFromHour}
                      label="From"
                      onChange={(e) => updateSetting('postFromHour', Number(e.target.value))}
                    >
                      {HOURS.map((hour) => (
                        <MenuItem key={hour.value} value={hour.value}>
                          {hour.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Until</InputLabel>
                    <Select
                      value={settings.postUntilHour}
                      label="Until"
                      onChange={(e) => updateSetting('postUntilHour', Number(e.target.value))}
                    >
                      {HOURS.map((hour) => (
                        <MenuItem key={hour.value} value={hour.value}>
                          {hour.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Posting Frequency */}
              <Typography variant="subtitle2" gutterBottom>
                Post Every: {settings.postIntervalMinutes} minutes
                <Tooltip title="Time between each vehicle posting">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Slider
                value={settings.postIntervalMinutes}
                onChange={(_, value) => updateSetting('postIntervalMinutes', value as number)}
                min={5}
                max={120}
                step={5}
                marks={[
                  { value: 5, label: '5m' },
                  { value: 30, label: '30m' },
                  { value: 60, label: '1h' },
                  { value: 120, label: '2h' },
                ]}
                valueLabelDisplay="auto"
                sx={{ mb: 3 }}
              />

              {/* Daily Limit */}
              <Typography variant="subtitle2" gutterBottom>
                Daily Post Limit: {settings.dailyPostLimit || 'No limit'}
                <Tooltip title="Maximum posts per day (0 = unlimited)">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Slider
                value={settings.dailyPostLimit}
                onChange={(_, value) => updateSetting('dailyPostLimit', value as number)}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '∞' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                ]}
                valueLabelDisplay="auto"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Posting Options */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Posting Options
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Priority */}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Posting Priority</InputLabel>
                <Select
                  value={settings.postingPriority}
                  label="Posting Priority"
                  onChange={(e) => updateSetting('postingPriority', e.target.value)}
                >
                  <MenuItem value="descending">Newest First (Descending)</MenuItem>
                  <MenuItem value="ascending">Oldest First (Ascending)</MenuItem>
                  <MenuItem value="price_high">Highest Price First</MenuItem>
                  <MenuItem value="price_low">Lowest Price First</MenuItem>
                </Select>
              </FormControl>

              {/* Videos */}
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.includeVideos}
                    onChange={(e) => updateSetting('includeVideos', e.target.checked)}
                  />
                }
                label="Include Videos in Posts"
                sx={{ mb: 1, display: 'block' }}
              />

              {settings.includeVideos && (
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Video Source</InputLabel>
                  <Select
                    value={settings.videoSource}
                    label="Video Source"
                    onChange={(e) => updateSetting('videoSource', e.target.value)}
                  >
                    <MenuItem value="walkaround">Walk-around Video</MenuItem>
                    <MenuItem value="videotour">Video Tour</MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Location */}
              <TextField
                fullWidth
                size="small"
                label="Posting Location"
                value={settings.postingLocation || ''}
                onChange={(e) => updateSetting('postingLocation', e.target.value)}
                placeholder="Enter city or ZIP code"
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" gutterBottom>
                Posting Radius: {settings.postingRadius} miles
              </Typography>
              <Slider
                value={settings.postingRadius}
                onChange={(_, value) => updateSetting('postingRadius', value as number)}
                min={5}
                max={100}
                step={5}
                marks={[
                  { value: 5, label: '5mi' },
                  { value: 25, label: '25mi' },
                  { value: 50, label: '50mi' },
                  { value: 100, label: '100mi' },
                ]}
                valueLabelDisplay="auto"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Auto-Renewal Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LoopIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Auto-Renewal & Repost
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Auto-Renew */}
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoRenewEnabled}
                      onChange={(e) => updateSetting('autoRenewEnabled', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1">Auto-Renew Listings</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatically renew active listings to stay at the top
                      </Typography>
                    </Box>
                  }
                />
                {settings.autoRenewEnabled && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Renew Every: {settings.renewFrequencyDays} days
                    </Typography>
                    <Slider
                      value={settings.renewFrequencyDays}
                      onChange={(_, value) => updateSetting('renewFrequencyDays', value as number)}
                      min={1}
                      max={14}
                      step={1}
                      marks={[
                        { value: 1, label: '1d' },
                        { value: 7, label: '7d' },
                        { value: 14, label: '14d' },
                      ]}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                )}
              </Box>

              {/* Auto-Repost */}
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoRepostEnabled}
                      onChange={(e) => updateSetting('autoRepostEnabled', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1">Auto-Repost Expired Listings</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Re-create listings that have been archived or removed
                      </Typography>
                    </Box>
                  }
                />
                {settings.autoRepostEnabled && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Repost After: {settings.repostFrequencyDays} days
                    </Typography>
                    <Slider
                      value={settings.repostFrequencyDays}
                      onChange={(_, value) => updateSetting('repostFrequencyDays', value as number)}
                      min={7}
                      max={90}
                      step={1}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 30, label: '30d' },
                        { value: 60, label: '60d' },
                        { value: 90, label: '90d' },
                      ]}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Price Updates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Price Synchronization
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoUpdatePrices}
                      onChange={(e) => updateSetting('autoUpdatePrices', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1">Auto-Update Prices</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatically update Facebook listing prices when inventory changes
                      </Typography>
                    </Box>
                  }
                />
                {settings.autoUpdatePrices && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Price Change Threshold: ${settings.priceChangeThreshold}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      Only update if price changed by more than this amount
                    </Typography>
                    <Slider
                      value={settings.priceChangeThreshold}
                      onChange={(_, value) => updateSetting('priceChangeThreshold', value as number)}
                      min={0}
                      max={1000}
                      step={50}
                      marks={[
                        { value: 0, label: '$0' },
                        { value: 250, label: '$250' },
                        { value: 500, label: '$500' },
                        { value: 1000, label: '$1k' },
                      ]}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                )}
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>How it works:</strong> When your inventory feed updates with a new price,
                  the system will automatically update the Facebook Marketplace listing to match.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        {status && status.recentPosts.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    <RefreshIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Recent Posting Activity
                  </Typography>
                  <Button startIcon={<RefreshIcon />} onClick={fetchStatus} size="small">
                    Refresh
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {status.recentPosts.map((post) => (
                    <Grid item xs={12} md={6} lg={4} key={post.id}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" noWrap>
                          {post.vehicle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Stock: {post.stockNumber || 'N/A'}
                        </Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                          <Chip
                            label={post.status}
                            size="small"
                            color={
                              post.status === 'ACTIVE'
                                ? 'success'
                                : post.status === 'PENDING'
                                ? 'warning'
                                : 'default'
                            }
                          />
                          <Typography variant="caption" color="text.secondary">
                            {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : 'Pending'}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Save Reminder */}
      {hasChanges && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            p: 2,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>You have unsaved changes</Typography>
            <Button
              variant="contained"
              color="inherit"
              onClick={saveSettings}
              disabled={saving}
              sx={{ color: 'warning.main' }}
            >
              Save Now
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
