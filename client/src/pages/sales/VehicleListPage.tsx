import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Search, Plus } from 'lucide-react';

interface Vehicle {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage: number;
  color?: string;
  description?: string;
  imageUrl?: string;
}

export const VehicleListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMake, setFilterMake] = useState('');

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles', searchTerm, filterYear, filterMake],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterYear) params.append('year', filterYear);
      if (filterMake) params.append('make', filterMake);
      
      const response = await api.get<{ success: boolean; data: Vehicle[] }>(`/vehicles?${params}`);
      return response.data.data;
    },
  });

  const { data: makes } = useQuery({
    queryKey: ['vehicleMakes'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: string[] }>('/vehicles/makes');
      return response.data.data;
    },
  });

  const handlePostVehicle = (vehicleId: string) => {
    navigate(`/sales/post/${vehicleId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vehicles</h1>
          <p className="mt-1 text-sm text-gray-500">Select vehicles to post to Facebook Marketplace</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by VIN, stock number, make, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">All Years</option>
              {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterMake}
              onChange={(e) => setFilterMake(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">All Makes</option>
              {makes?.map(make => (
                <option key={make} value={make}>{make}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vehicle Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading vehicles...</div>
        </div>
      ) : vehicles && vehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                {vehicle.imageUrl ? (
                  <img
                    src={vehicle.imageUrl}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="object-cover w-full h-48"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 bg-gray-100">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
                {vehicle.trim && (
                  <p className="text-sm text-gray-500">{vehicle.trim}</p>
                )}
                
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Stock #</span>
                    <span className="font-medium text-gray-900">{vehicle.stockNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mileage</span>
                    <span className="font-medium text-gray-900">{vehicle.mileage.toLocaleString()} mi</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Price</span>
                    <span className="font-medium text-gray-900 text-lg">${vehicle.price.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => handlePostVehicle(vehicle.id)}
                  className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Post to Facebook
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No vehicles found</p>
        </div>
      )}
    </div>
  );
};
