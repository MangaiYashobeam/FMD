import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Trash2,
  Facebook,
  ChevronLeft,
  ChevronRight,
  Car,
  Loader2,
  X,
  DollarSign,
  Calendar,
  Gauge,
  Tag,
  MapPin,
  Send,
  Bot,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Share2,
  RefreshCw,
  GripVertical,
  Terminal,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Vehicle Image Component with error handling for broken images
function VehicleImage({ 
  src, 
  alt, 
  className,
  fallbackClassName,
  iconSize = 'w-6 h-6'
}: { 
  src?: string; 
  alt: string; 
  className?: string;
  fallbackClassName?: string;
  iconSize?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  if (!src || hasError) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-gray-100', fallbackClassName)}>
        <Car className={cn(iconSize, 'text-gray-400')} />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className={cn('w-full h-full flex items-center justify-center bg-gray-100 absolute inset-0', fallbackClassName)}>
          <Loader2 className={cn(iconSize, 'text-gray-400 animate-spin')} />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, isLoading && 'opacity-0')}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </>
  );
}

interface Vehicle {
  id: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  color?: string;
  exteriorColor?: string;
  interiorColor?: string;
  vin?: string;
  status: 'active' | 'sold' | 'pending';
  photos: string[];
  imageUrls?: string[];
  postedToFacebook: boolean;
  facebookPostId?: string;
  description?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  drivetrain?: string;
  engine?: string;
  doors?: number;
  features?: string[];
  createdAt: string;
  updatedAt?: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-100 text-green-700',
    sold: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-full capitalize',
        styles[status as keyof typeof styles] || styles.pending
      )}
    >
      {status}
    </span>
  );
}

// Vehicle Detail Modal
function VehicleDetailModal({ vehicle, onClose, onEdit }: { vehicle: Vehicle; onClose: () => void; onEdit: () => void }) {
  const photos = vehicle.photos?.length ? vehicle.photos : vehicle.imageUrls || [];
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <p className="text-sm text-gray-500">{vehicle.trim} • Stock #{vehicle.stockNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Photo Gallery */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden relative">
                  <VehicleImage
                    src={photos[selectedPhoto]}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                    iconSize="w-16 h-16"
                  />
                </div>
                {photos.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {photos.slice(0, 8).map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPhoto(i)}
                        className={cn(
                          'w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 relative',
                          selectedPhoto === i ? 'border-blue-500' : 'border-transparent'
                        )}
                      >
                        <VehicleImage src={photo} alt="" className="w-full h-full object-cover" iconSize="w-4 h-4" />
                      </button>
                    ))}
                    {photos.length > 8 && (
                      <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm text-gray-500">+{photos.length - 8}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Info */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-3xl font-bold text-gray-900">
                    ${vehicle.price?.toLocaleString() || 'Call'}
                  </div>
                  <StatusBadge status={vehicle.status} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InfoCard icon={Gauge} label="Mileage" value={vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : '-'} />
                  <InfoCard icon={Tag} label="VIN" value={vehicle.vin || '-'} />
                  <InfoCard icon={Calendar} label="Year" value={vehicle.year.toString()} />
                  <InfoCard icon={Car} label="Body" value={vehicle.bodyType || '-'} />
                  <InfoCard icon={Zap} label="Fuel" value={vehicle.fuelType || '-'} />
                  <InfoCard icon={Gauge} label="Trans" value={vehicle.transmission || '-'} />
                </div>

                <div className="flex items-center gap-2">
                  {vehicle.postedToFacebook ? (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                      <Facebook className="w-4 h-4" />
                      <span className="text-sm font-medium">Posted to Facebook</span>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                      <Facebook className="w-4 h-4" />
                      <span className="text-sm">Not posted yet</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {vehicle.description && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{vehicle.description}</p>
              </div>
            )}

            {/* Features */}
            {vehicle.features && vehicle.features.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {vehicle.features.map((feature, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-medium text-gray-900 truncate" title={value}>{value}</p>
    </div>
  );
}

// Facebook Ad Preview & Edit Modal
function FacebookAdPreviewModal({ 
  vehicle, 
  onClose, 
  onPost,
  onRefresh,
}: { 
  vehicle: Vehicle; 
  onClose: () => void;
  onPost: (data: {
    vehicleId: string;
    title: string;
    price: number;
    description: string;
    photos: string[];
    method: string;
    includePixelTracking?: boolean;
  }) => void;
  onRefresh?: () => void;
}) {
  const photos = vehicle.photos?.length ? vehicle.photos : vehicle.imageUrls || [];
  const [title, setTitle] = useState(`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim());
  const [price, setPrice] = useState(vehicle.price?.toString() || '');
  const [description, setDescription] = useState(
    vehicle.description || generateDefaultDescription(vehicle)
  );
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(photos.slice(0, 10));
  const [postMethod, setPostMethod] = useState<'api' | 'iai' | 'soldier' | 'puppeteer'>('iai');
  const [includePixelTracking, setIncludePixelTracking] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [dragOverPhoto, setDragOverPhoto] = useState<string | null>(null);
  const [wasDragging, setWasDragging] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  function generateDefaultDescription(v: Vehicle): string {
    const parts = [
      `🚗 ${v.year} ${v.make} ${v.model} ${v.trim || ''}`,
      '',
      v.mileage ? `📍 Mileage: ${v.mileage.toLocaleString()} miles` : null,
      v.exteriorColor || v.color ? `🎨 Color: ${v.exteriorColor || v.color}` : null,
      v.transmission ? `⚙️ Transmission: ${v.transmission}` : null,
      v.fuelType ? `⛽ Fuel: ${v.fuelType}` : null,
      v.drivetrain ? `🔧 Drivetrain: ${v.drivetrain}` : null,
      v.engine ? `🏎️ Engine: ${v.engine}` : null,
      '',
      `💰 Price: $${v.price?.toLocaleString() || 'Call for pricing'}`,
      '',
      `📞 Contact us today!`,
      `Stock #${v.stockNumber}`,
    ].filter(Boolean);
    return parts.join('\n');
  }

  const handlePost = async () => {
    setPosting(true);
    try {
      await onPost({
        vehicleId: vehicle.id,
        title,
        price: parseFloat(price) || vehicle.price,
        description,
        photos: selectedPhotos,
        method: postMethod,
        includePixelTracking,
      });
    } finally {
      setPosting(false);
    }
  };

  const togglePhotoSelection = (photo: string) => {
    if (selectedPhotos.includes(photo)) {
      setSelectedPhotos(selectedPhotos.filter(p => p !== photo));
    } else if (selectedPhotos.length < 10) {
      setSelectedPhotos([...selectedPhotos, photo]);
    }
  };

  // Unified drag and drop for ALL photos (selected and unselected)
  // Photos can be swapped by dragging next to each other
  const handleDragStart = (e: React.DragEvent, photo: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', photo);
    setDraggedPhoto(photo);
  };

  const handleDragOver = (e: React.DragEvent, targetPhoto: string) => {
    if (draggedPhoto && draggedPhoto !== targetPhoto) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverPhoto(targetPhoto);
    }
  };

  const handleDrop = (e: React.DragEvent, targetPhoto: string) => {
    e.preventDefault();
    
    if (!draggedPhoto || draggedPhoto === targetPhoto) {
      setDraggedPhoto(null);
      setDragOverPhoto(null);
      return;
    }

    const isDraggedSelected = selectedPhotos.includes(draggedPhoto);
    const isTargetSelected = selectedPhotos.includes(targetPhoto);

    if (isDraggedSelected && isTargetSelected) {
      // Both selected: swap their positions in selectedPhotos
      const newPhotos = [...selectedPhotos];
      const draggedIdx = newPhotos.indexOf(draggedPhoto);
      const targetIdx = newPhotos.indexOf(targetPhoto);
      [newPhotos[draggedIdx], newPhotos[targetIdx]] = [newPhotos[targetIdx], newPhotos[draggedIdx]];
      setSelectedPhotos(newPhotos);
      
      // Update current photo index if needed
      if (currentPhotoIndex === draggedIdx) {
        setCurrentPhotoIndex(targetIdx);
      } else if (currentPhotoIndex === targetIdx) {
        setCurrentPhotoIndex(draggedIdx);
      }
    } else if (isDraggedSelected && !isTargetSelected) {
      // Selected dropped on unselected: replace target with dragged, move dragged out
      const newPhotos = selectedPhotos.filter(p => p !== draggedPhoto);
      const targetIdx = newPhotos.indexOf(targetPhoto);
      if (targetIdx >= 0) {
        // Target is in selected (shouldn't happen but handle it)
        newPhotos[targetIdx] = draggedPhoto;
      } else {
        // Target not selected - add dragged at end
        if (newPhotos.length < 10) {
          newPhotos.push(draggedPhoto);
        }
      }
      setSelectedPhotos(newPhotos);
    } else if (!isDraggedSelected && isTargetSelected) {
      // Unselected dropped on selected: add dragged, kick out last if needed
      const targetIdx = selectedPhotos.indexOf(targetPhoto);
      const newPhotos = [...selectedPhotos];
      
      if (newPhotos.length >= 10) {
        // Replace target with dragged (swap them)
        newPhotos[targetIdx] = draggedPhoto;
      } else {
        // Just insert dragged at target position
        newPhotos.splice(targetIdx, 0, draggedPhoto);
      }
      
      setSelectedPhotos(newPhotos.slice(0, 10)); // Keep max 10
    } else {
      // Both unselected: do nothing (they're not in the selection)
    }
    
    setDraggedPhoto(null);
    setDragOverPhoto(null);
  };

  const handleDragEnd = () => {
    // Mark that we were dragging to prevent click handler
    if (draggedPhoto !== null) {
      setWasDragging(true);
      setTimeout(() => setWasDragging(false), 100);
    }
    setDraggedPhoto(null);
    setDragOverPhoto(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <Facebook className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Facebook Marketplace Ad</h2>
                <p className="text-sm text-gray-500">Preview and customize your listing</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-200">
              {/* Edit Form */}
              <div className="p-6 space-y-6">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Listing
                </h3>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
                </div>

                {/* Price with Refresh Button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Price</label>
                    {onRefresh && (
                      <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        title="Refresh price and data from CSV source"
                      >
                        <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                        {refreshing ? 'Refreshing...' : 'Refresh from CSV'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={8}
                    maxLength={5000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{description.length}/5000 characters</p>
                </div>

                {/* Photos - Drag to Reorder (Merged Section) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photos ({selectedPhotos.length}/10) - Drag to reorder, click to remove
                  </label>
                  
                  {/* Facebook Marketplace 10-photo limit disclaimer */}
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="text-amber-800 font-medium">Facebook Marketplace Limit: 10 Photos Maximum</p>
                        <p className="text-amber-700 mt-0.5">
                          Only the first 10 selected photos will be uploaded. Photos beyond the limit are shown faded and marked "Won't Upload".
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-2">First photo will be the main listing image. Drag photos to change order.</p>
                  
                  {/* Photos grid - Selected photos first in order, then unselected */}
                  <div className="grid grid-cols-5 gap-3 p-3 bg-gray-50 rounded-lg min-h-[120px]">
                    {photos.length === 0 ? (
                      <p className="text-gray-400 text-sm col-span-5 m-auto py-8">No photos available</p>
                    ) : (
                      <>
                        {/* Selected photos - rendered in their correct order */}
                        {selectedPhotos.map((photo, selectedIndex) => {
                          const isDragging = draggedPhoto !== null;
                          const isBeingDragged = draggedPhoto === photo;
                          const isDropTarget = dragOverPhoto === photo;
                          
                          return (
                            <div
                              key={`selected-${photo}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, photo)}
                              onDragOver={(e) => handleDragOver(e, photo)}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                setDragOverPhoto(null);
                              }}
                              onDrop={(e) => handleDrop(e, photo)}
                              onDragEnd={handleDragEnd}
                              onClick={() => !isDragging && !wasDragging && togglePhotoSelection(photo)}
                              title={selectedIndex === 0 ? 'Main Photo 🌟 - Drag to reorder or click to remove' : `Photo ${selectedIndex + 1} - Drag to reorder or click to remove`}
                              className={cn(
                                'relative aspect-square rounded-lg overflow-hidden border-2 transition-all group select-none cursor-grab active:cursor-grabbing',
                                selectedIndex === 0 
                                  ? 'ring-2 ring-green-400 border-green-500' 
                                  : 'border-blue-500 bg-blue-50',
                                isBeingDragged && 'opacity-50 scale-95',
                                isDropTarget && 'ring-2 ring-purple-500 scale-105'
                              )}
                            >
                              <div className="w-full h-full">
                                <VehicleImage src={photo} alt="" className="w-full h-full object-cover pointer-events-none" iconSize="w-4 h-4" />
                              </div>
                              
                              {/* Order number badge */}
                              <div className={cn(
                                'absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md pointer-events-none',
                                selectedIndex === 0 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                              )}>
                                {selectedIndex + 1}
                              </div>
                              
                              {/* Drag handle */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="w-4 h-4 text-white drop-shadow-lg pointer-events-none" />
                              </div>
                              
                              {/* Main photo indicator */}
                              {selectedIndex === 0 && (
                                <div className="absolute bottom-1 left-1 right-1 pointer-events-none">
                                  <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-medium">Main Photo</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Unselected photos - NOW DRAGGABLE TOO */}
                        {photos.filter(photo => !selectedPhotos.includes(photo)).map((photo) => {
                          const wouldExceedLimit = selectedPhotos.length >= 10;
                          const isDragging = draggedPhoto !== null;
                          const isBeingDragged = draggedPhoto === photo;
                          const isDropTarget = dragOverPhoto === photo;
                          
                          return (
                            <div
                              key={`unselected-${photo}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, photo)}
                              onDragOver={(e) => handleDragOver(e, photo)}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                setDragOverPhoto(null);
                              }}
                              onDrop={(e) => handleDrop(e, photo)}
                              onDragEnd={handleDragEnd}
                              onClick={() => !isDragging && !wasDragging && !wouldExceedLimit && togglePhotoSelection(photo)}
                              title={wouldExceedLimit ? "🚫 Won't Upload (10 photo limit) - Drag to swap with selected photo" : '➕ Click to add or drag to swap with selected photo'}
                              className={cn(
                                'relative aspect-square rounded-lg overflow-hidden border-2 transition-all group select-none',
                                wouldExceedLimit
                                  ? 'border-red-200 bg-red-50 cursor-grab active:cursor-grabbing'
                                  : 'border-gray-200 hover:border-gray-300 opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing',
                                isBeingDragged && 'opacity-30 scale-95',
                                isDropTarget && wouldExceedLimit && 'ring-2 ring-blue-500 scale-105',
                                isDropTarget && !wouldExceedLimit && 'ring-2 ring-purple-500 scale-105'
                              )}
                            >
                              <VehicleImage src={photo} alt="" className="w-full h-full object-cover pointer-events-none" iconSize="w-4 h-4" />
                              
                              {/* "Won't Upload" overlay - but still draggable */}
                              {wouldExceedLimit && !isBeingDragged && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 pointer-events-none">
                                  <div className="text-center">
                                    <X className="w-6 h-6 text-white mx-auto" />
                                    <span className="text-[10px] text-white font-medium block mt-0.5">Won't Upload</span>
                                    <span className="text-[9px] text-white/80 block mt-0.5">Drag to swap</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Add icon for unselected photos under limit */}
                              {!wouldExceedLimit && !isBeingDragged && (
                                <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-gray-400/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <Plus className="w-3 h-3 text-white" />
                                </div>
                              )}
                              
                              {/* Drag handle for unselected */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="w-4 h-4 text-white drop-shadow-lg pointer-events-none" />
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                  
                  {/* Selected count indicator */}
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>Click unselected photos to add them</span>
                    <span className={cn(
                      selectedPhotos.length >= 10 ? 'text-orange-600 font-medium' : ''
                    )}>
                      {selectedPhotos.length}/10 selected
                    </span>
                  </div>
                  
                  {/* Usage Instructions */}
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-xs font-semibold text-blue-900 mb-2">📸 How to Use Photo Selection</h4>
                    <ul className="space-y-1.5 text-xs text-blue-800">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                        <span><strong>Click numbered photo</strong> to add/remove from selection (max 10)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                        <span><strong>Drag & drop</strong> any photo to reorder - swap positions instantly</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                        <span><strong>First photo (green border)</strong> = Main listing image on Facebook</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
                        <span><strong>"Won't Upload" photos</strong> (faded red) can be dragged to swap with selected ones</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">5.</span>
                        <span><strong>Uncheck numbered photos</strong> to free slots and add different images</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Posting Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Posting Method</label>
                  <div className="space-y-2">
                    <label className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                      postMethod === 'iai' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="postMethod"
                        checked={postMethod === 'iai'}
                        onChange={() => setPostMethod('iai')}
                        className="text-blue-600"
                      />
                      <Bot className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">IAI - Intelligent Auto Integration</p>
                        <p className="text-xs text-gray-500">Automated browser posting via extension</p>
                      </div>
                      <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Recommended</span>
                    </label>
                    <label className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                      postMethod === 'soldier' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="postMethod"
                        checked={postMethod === 'soldier'}
                        onChange={() => setPostMethod('soldier')}
                        className="text-blue-600"
                      />
                      <Send className="w-5 h-5 text-orange-600" />
                      <div>
                        <p className="font-medium text-gray-900">Soldier Workers</p>
                        <p className="text-xs text-gray-500">Server-side headless browser automation</p>
                      </div>
                      <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">No Extension</span>
                    </label>
                    <label className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                      postMethod === 'puppeteer' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="postMethod"
                        checked={postMethod === 'puppeteer'}
                        onChange={() => setPostMethod('puppeteer')}
                        className="text-blue-600"
                      />
                      <Terminal className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="font-medium text-gray-900">IAI Official (Puppeteer)</p>
                        <p className="text-xs text-gray-500">Server-side Chromium with Official-P1 pattern</p>
                      </div>
                      <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Production</span>
                    </label>
                    <label className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                      postMethod === 'api' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="postMethod"
                        checked={postMethod === 'api'}
                        onChange={() => setPostMethod('api')}
                        className="text-blue-600"
                      />
                      <Zap className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Facebook API</p>
                        <p className="text-xs text-gray-500">Direct API posting (requires approval)</p>
                      </div>
                    </label>
                  </div>
                  
                  {/* Facebook Pixel Addon */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className={cn(
                      'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                      includePixelTracking ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="checkbox"
                        checked={includePixelTracking}
                        onChange={(e) => setIncludePixelTracking(e.target.checked)}
                        className="mt-1 text-green-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Share2 className="w-5 h-5 text-green-600" />
                          <p className="font-medium text-gray-900">Include Facebook Pixel Tracking</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Fire conversion events to track user engagement and enable retargeting ads.
                        </p>
                        {includePixelTracking && (
                          <div className="mt-2 text-xs text-green-700 bg-green-100 px-2 py-1 rounded inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Pixel events will be recorded when listing is posted
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Facebook Preview */}
              <div className="p-6 bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Eye className="w-4 h-4" />
                  Facebook Marketplace Preview
                </h3>

                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  {/* FB Header */}
                  <div className="bg-[#1877f2] px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Facebook className="w-5 h-5 text-white" />
                      <span className="text-white font-semibold text-sm">Marketplace</span>
                    </div>
                  </div>

                  {/* Image Carousel */}
                  <div className="relative aspect-[4/3] bg-gray-100">
                    <VehicleImage
                      src={selectedPhotos[currentPhotoIndex]}
                      alt=""
                      className="w-full h-full object-cover"
                      iconSize="w-12 h-12"
                    />
                    {selectedPhotos.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentPhotoIndex(i => Math.max(0, i - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setCurrentPhotoIndex(i => Math.min(selectedPhotos.length - 1, i + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                          {currentPhotoIndex + 1} / {selectedPhotos.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* FB Content */}
                  <div className="p-4">
                    <p className="text-2xl font-bold text-gray-900">${parseFloat(price || '0').toLocaleString()}</p>
                    <h3 className="text-lg font-semibold text-gray-900 mt-1">{title}</h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                      <MapPin className="w-4 h-4" />
                      <span>Your Location</span>
                      <span>•</span>
                      <Clock className="w-4 h-4" />
                      <span>Just now</span>
                    </div>
                    
                    {/* FB Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button className="flex-1 py-2 bg-[#1877f2] text-white font-semibold rounded-lg text-sm">
                        Message Seller
                      </button>
                      <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                        Save
                      </button>
                    </div>

                    {/* Description Preview */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 text-sm mb-2">Description</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-6">{description}</p>
                    </div>
                  </div>
                </div>

                {/* Method Info Boxes */}
                {postMethod === 'iai' && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Bot className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-purple-900">IAI Automated Posting</h4>
                        <p className="text-sm text-purple-700 mt-1">
                          The extension will automatically:
                        </p>
                        <ul className="text-sm text-purple-700 mt-2 space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Navigate to Facebook Marketplace
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Create a new vehicle listing
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Upload photos and fill details
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Submit the listing for you
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {postMethod === 'soldier' && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Send className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-orange-900">Soldier Workers (Headless)</h4>
                        <p className="text-sm text-orange-700 mt-1">
                          Server-side automated posting:
                        </p>
                        <ul className="text-sm text-orange-700 mt-2 space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            No browser extension required
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Runs on our servers 24/7
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Uses headless Playwright browsers
                          </li>
                          <li className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Requires Facebook session setup
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {postMethod === 'puppeteer' && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Terminal className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-emerald-900">IAI Official (Puppeteer) - FBM-Official-P1</h4>
                        <p className="text-sm text-emerald-700 mt-1">
                          Production-verified server-side automation:
                        </p>
                        <ul className="text-sm text-emerald-700 mt-2 space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Uses verified FBM-Official-P1 pattern (166 steps)
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Headless Chromium with stealth plugins
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Full form fill + image upload + wizard navigation
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            No browser extension required
                          </li>
                          <li className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Requires linked Facebook session
                          </li>
                        </ul>
                        <p className="text-xs text-emerald-600 mt-2 font-medium">
                          ✅ Verified working - Last tested Jan 27, 2026
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {postMethod === 'api' && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900">Facebook Graph API</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Direct API posting limitations:
                        </p>
                        <ul className="text-sm text-blue-700 mt-2 space-y-1">
                          <li className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Only posts to Facebook Pages (not Marketplace)
                          </li>
                          <li className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Facebook has NO public Marketplace API
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Good for Page feed posts with vehicle info
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Can link to your website inventory
                          </li>
                        </ul>
                        <p className="text-xs text-blue-600 mt-2 font-medium">
                          💡 Use IAI or Soldier for actual Marketplace listings
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pixel Tracking Info (when enabled) */}
                {includePixelTracking && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Share2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-green-900">Pixel Tracking Enabled</h4>
                        <p className="text-sm text-green-700 mt-1">
                          The following events will be tracked:
                        </p>
                        <ul className="text-sm text-green-700 mt-2 space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            ViewContent - When listing is viewed
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            InitiateCheckout - When buyer shows interest
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Lead - When message is sent
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Enable retargeting ads to interested users
                          </li>
                        </ul>
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          📊 View pixel metrics in the Analytics dashboard
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={posting || selectedPhotos.length === 0}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {posting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Post to Facebook
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ vehicle, onClose, onConfirm, deleting }: { 
  vehicle: Vehicle; 
  onClose: () => void; 
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Delete Vehicle</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const accountId = user?.accounts?.[0]?.id;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  
  // Modal states
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [postingVehicle, setPostingVehicle] = useState<Vehicle | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicles', accountId, page, search, statusFilter],
    queryFn: async () => {
      if (!accountId) return { data: { vehicles: [], pagination: { page: 1, totalPages: 1, total: 0 } } };
      const response = await vehiclesApi.getAll({
        accountId,
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      return response.data;
    },
    enabled: !!accountId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      return vehiclesApi.delete(vehicleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDeletingVehicle(null);
      toast.success('Vehicle deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete vehicle');
    },
  });

  // Refresh vehicle from source mutation
  const refreshFromSourceMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      return vehiclesApi.refreshFromSource(vehicleId);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // Update the editing vehicle with fresh data
      if (editingVehicle && response?.data?.data) {
        setEditingVehicle(response.data.data);
      }
      toast.success('Vehicle refreshed from source');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to refresh vehicle');
    },
  });

  // Post to Facebook mutation
  const postToFacebookMutation = useMutation({
    mutationFn: async (data: {
      vehicleId: string;
      title: string;
      price: number;
      description: string;
      photos: string[];
      method: string;
      includePixelTracking?: boolean;
    }) => {
      // This will trigger the IAI task for the extension
      return vehiclesApi.postToFacebook(data.vehicleId, {
        title: data.title,
        price: data.price,
        description: data.description,
        photos: data.photos,
        method: data.method,
        includePixelTracking: data.includePixelTracking,
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setPostingVehicle(null);
      setEditingVehicle(null);
      
      const data = response?.data?.data;
      const method = data?.method || 'unknown';
      const message = response?.data?.message || 'Task created successfully';
      const pixelEnabled = data?.pixelTracking;
      
      // Display appropriate success message based on method
      if (method === 'iai') {
        toast.success(`IAI Task Queued! ${message}${pixelEnabled ? ' (Pixel tracking enabled)' : ''}`);
      } else if (method === 'soldier') {
        toast.success(`Soldier Worker Task Queued! ${message}${pixelEnabled ? ' (Pixel tracking enabled)' : ''}`);
      } else if (method === 'api') {
        toast.info(`Facebook API: ${message}`);
      } else {
        toast.success(message);
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.response?.data?.message || 'Failed to post to Facebook';
      toast.error(message);
    },
  });

  const vehicles: Vehicle[] = data?.data?.vehicles || [];
  const pagination = data?.data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const toggleSelectAll = () => {
    if (selectedVehicles.length === vehicles.length) {
      setSelectedVehicles([]);
    } else {
      setSelectedVehicles(vehicles.map((v) => v.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedVehicles((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage?: number) => {
    if (!mileage) return '-';
    return new Intl.NumberFormat('en-US').format(mileage) + ' mi';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">Manage your vehicle listings</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          <Plus className="w-5 h-5" />
          Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by stock #, make, model, VIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Selected actions */}
        {selectedVehicles.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">
              {selectedVehicles.length} vehicle(s) selected
            </span>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                <Facebook className="w-4 h-4" />
                Post to Facebook
              </button>
              <button className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="mt-2 text-gray-500">Loading vehicles...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto" />
            <p className="mt-2 text-gray-500">Failed to load vehicles</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center">
            <Car className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No vehicles found</h3>
            <p className="mt-1 text-gray-500">
              {search ? 'Try adjusting your search' : 'Get started by syncing your inventory'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedVehicles.length === vehicles.length && vehicles.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mileage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      FB
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((vehicle) => {
                    const photos = vehicle.photos?.length ? vehicle.photos : vehicle.imageUrls || [];
                    return (
                      <tr key={vehicle.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedVehicles.includes(vehicle.id)}
                            onChange={() => toggleSelect(vehicle.id)}
                            className="w-4 h-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                              <VehicleImage
                                src={photos[0]}
                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                className="w-full h-full object-cover"
                                iconSize="w-6 h-6"
                              />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </p>
                              <p className="text-sm text-gray-500">
                                {vehicle.trim} {(vehicle.color || vehicle.exteriorColor) && `• ${vehicle.color || vehicle.exteriorColor}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{vehicle.stockNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatPrice(vehicle.price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatMileage(vehicle.mileage)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={vehicle.status} />
                        </td>
                        <td className="px-4 py-3">
                          {vehicle.postedToFacebook ? (
                            <div className="flex items-center gap-1">
                              <Facebook className="w-5 h-5 text-blue-600" />
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            </div>
                          ) : (
                            <Facebook className="w-5 h-5 text-gray-300" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => setViewingVehicle(vehicle)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setPostingVehicle(vehicle)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Post to Facebook"
                            >
                              <Facebook className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setEditingVehicle(vehicle)}
                              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Edit Vehicle"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeletingVehicle(vehicle)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Vehicle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, pagination.total)} of{' '}
                {pagination.total} vehicles
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={page === (pagination.totalPages || 1)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {viewingVehicle && (
        <VehicleDetailModal
          vehicle={viewingVehicle}
          onClose={() => setViewingVehicle(null)}
          onEdit={() => {
            setEditingVehicle(viewingVehicle);
            setViewingVehicle(null);
          }}
        />
      )}

      {postingVehicle && (
        <FacebookAdPreviewModal
          vehicle={postingVehicle}
          onClose={() => setPostingVehicle(null)}
          onPost={(data) => postToFacebookMutation.mutate(data)}
          onRefresh={() => refreshFromSourceMutation.mutate(postingVehicle.id)}
        />
      )}

      {deletingVehicle && (
        <DeleteConfirmModal
          vehicle={deletingVehicle}
          onClose={() => setDeletingVehicle(null)}
          onConfirm={() => deleteMutation.mutate(deletingVehicle.id)}
          deleting={deleteMutation.isPending}
        />
      )}

      {editingVehicle && (
        <FacebookAdPreviewModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onPost={(data) => postToFacebookMutation.mutate(data)}
          onRefresh={() => refreshFromSourceMutation.mutate(editingVehicle.id)}
        />
      )}
    </div>
  );
}
