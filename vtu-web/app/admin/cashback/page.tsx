"use client";

import React, { useState } from "react";
import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  Activity, 
  MoreVertical, 
  Edit, 
  Trash2, 
  BarChart 
} from "lucide-react";

// Mock data to preview the UI - replace with your actual API data
const MOCK_CAMPAIGNS = [
  {
    id: "camp_1",
    name: "Weekend MTN Data Rush",
    target: "MTN Data",
    type: "percentile",
    value: 5,
    status: "active",
    spent: 45000,
    startDate: "2026-06-18",
    endDate: "2026-06-21",
  },
  {
    id: "camp_2",
    name: "New User Welcome",
    target: "All Services",
    type: "fixed",
    value: 100,
    status: "active",
    spent: 12500,
    startDate: "2026-06-01",
    endDate: "2026-06-30",
  },
  {
    id: "camp_3",
    name: "Holiday Cable Promo",
    target: "Cable TV",
    type: "percentile",
    value: 2.5,
    status: "ended",
    spent: 89000,
    startDate: "2025-12-20",
    endDate: "2026-01-05",
  },
];

export default function AdminCashbackPage() {
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Active</span>;
      case "scheduled":
        return <span className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">Scheduled</span>;
      case "ended":
        return <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">Ended</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cashback Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Manage reward programs and monitor cashback payouts.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
          <Plus size={18} />
          Create Campaign
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Campaigns</p>
            <h3 className="text-2xl font-bold text-gray-900">2</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Rewarded (This Month)</p>
            <h3 className="text-2xl font-bold text-gray-900">₦57,500</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Avg. ROI</p>
            <h3 className="text-2xl font-bold text-gray-900">+14.2%</h3>
          </div>
        </div>
      </div>

      {/* Campaigns Table Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Campaign History</h2>
          {/* Optional: Add a search bar or filter dropdown here */}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Campaign Name</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Reward</th>
                <th className="px-6 py-4 font-medium">Total Spent</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {campaign.startDate} to {campaign.endDate}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{campaign.target}</td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">
                      {campaign.type === "percentile" ? `${campaign.value}%` : `₦${campaign.value}`}
                    </span>
                    <span className="text-xs text-gray-500 ml-1 block capitalize">{campaign.type}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">
                    ₦{campaign.spent.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(campaign.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      <button className="hover:text-blue-600 transition-colors" title="View Analytics">
                        <BarChart size={18} />
                      </button>
                      <button className="hover:text-gray-900 transition-colors" title="Edit">
                        <Edit size={18} />
                      </button>
                      <button className="hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No campaigns found. Click "Create Campaign" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}