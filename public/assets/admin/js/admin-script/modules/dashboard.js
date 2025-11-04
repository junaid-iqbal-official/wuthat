'use strict';

import { Logger } from "./utils/logger.js";

export class DashboardChartManager {
    constructor() {
        this.logger = new Logger('DashboardChartManager');
        this.colors = {
            primary: '#7366ff',
            success: '#28c76f',
            danger: '#f73164',
            warning: '#fa8b0c',
            info: '#00bad1',
            secondary: '#82868b'
        };
    }

    // Safe data parsing function
    safeParseJSON(elementId, fallback = []) {
        try {
            const element = document.getElementById(elementId);
            if (!element || !element.textContent) return fallback;
            const data = JSON.parse(element.textContent);
            return Array.isArray(data) ? data : fallback;
        } catch (e) {
            console.warn('Error parsing ' + elementId + ':', e);
            return fallback;
        }
    }

    // Initialize all dashboard charts
    initialize() {
        try {
            this.logger.debug('Initializing dashboard charts');
            
            // Get data safely
            const dailyData = this.safeParseJSON('dailyMessageData');
            const messageTypeData = this.safeParseJSON('messageTypeData');
            const reportTypeData = this.safeParseJSON('reportTypeData');
            const hourlyData = this.safeParseJSON('hourlyMessageData');
            const weeklyGrowthData = this.safeParseJSON('weeklyGrowthData');

            // Initialize each chart
            this.createDailyMessageChart(dailyData);
            this.createHourlyActivityChart(hourlyData);
            this.createMessageTypesChart(messageTypeData);
            this.createReportTypesChart(reportTypeData);
            this.createWeeklyGrowthChart(weeklyGrowthData);

            this.logger.info('Dashboard charts initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize dashboard charts', error);
            return false;
        }
    }

    // 1. Daily Message Activity Chart
    createDailyMessageChart(dailyData) {
        const ctx = document.getElementById('messageActivityChart');
        if (!ctx) return;

        if (dailyData.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">No daily data available</p>';
            return;
        }

        try {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyData.map(d => {
                        try {
                            return new Date(d.date).toLocaleDateString();
                        } catch (e) {
                            return d.date || 'N/A';
                        }
                    }),
                    datasets: [{
                        label: 'Messages',
                        data: dailyData.map(d => parseInt(d.count) || 0),
                        borderColor: '#1c9dea',
                        backgroundColor: '#1c9dea20',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#1c9dea',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        } catch (e) {
            console.error('Error creating daily message chart:', e);
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">Chart unavailable</p>';
        }
    }

    // 2. Hourly Activity Chart
    createHourlyActivityChart(hourlyData) {
        const ctx = document.getElementById('hourlyActivityChart');
        if (!ctx) return;

        if (hourlyData.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">No hourly data available</p>';
            return;
        }

        try {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: hourlyData.map(d => d.hour + ':00'),
                    datasets: [{
                        label: 'Messages',
                        data: hourlyData.map(d => parseInt(d.count) || 0),
                        backgroundColor: this.colors.info,
                        borderRadius: 4,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        } catch (e) {
            console.error('Error creating hourly chart:', e);
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">Chart unavailable</p>';
        }
    }

    // 3. Message Types Chart
    createMessageTypesChart(messageTypeData) {
        const ctx = document.getElementById('messageTypesChart');
        if (!ctx) return;

        if (messageTypeData.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">No message type data available</p>';
            return;
        }

        try {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: messageTypeData.map(d => {
                        const type = d.message_type || 'unknown';
                        return type.charAt(0).toUpperCase() + type.slice(1);
                    }),
                    datasets: [{
                        data: messageTypeData.map(d => parseInt(d.count) || 0),
                        backgroundColor: [
                            '#1c9dea', '#65c15c', '#fc564a', '#ffb829',
                            '#40b8f5', '#838383', '#ff6b6b', '#4ecdc4'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        } catch (e) {
            console.error('Error creating message types chart:', e);
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">Chart unavailable</p>';
        }
    }

    // 4. Report Types Chart
    createReportTypesChart(reportTypeData) {
        const ctx = document.getElementById('reportTypesChart');
        if (!ctx) return;

        if (reportTypeData.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">No report data available</p>';
            return;
        }

        try {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: reportTypeData.map(d => {
                        const type = d.report_type || 'unknown';
                        return type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1);
                    }),
                    datasets: [{
                        label: null,
                        data: reportTypeData.map(d => parseInt(d.count) || 0),
                        backgroundColor: ['#fc564a', '#1c9dea', '#4ecdc4', '#ffb829'],
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: false
                    },
                    scales: {
                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Error creating report types chart:', e);
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">Chart unavailable</p>';
        }
    }

    // 5. Weekly Growth Chart
    createWeeklyGrowthChart(weeklyGrowthData) {
        const ctx = document.getElementById('weeklyGrowthChart');
        if (!ctx) return;

        if (weeklyGrowthData.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">No weekly growth data available</p>';
            return;
        }

        try {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: weeklyGrowthData.map(d => `Week ${d.week}`),
                    datasets: [{
                        label: 'New Users',
                        data: weeklyGrowthData.map(d => parseInt(d.count) || 0),
                        borderColor: this.colors.success,
                        backgroundColor: this.colors.success + '20',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: this.colors.success,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        } catch (e) {
            console.error('Error creating weekly growth chart:', e);
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">Chart unavailable</p>';
        }
    }

    // Check if dashboard page exists
    static isDashboardPage() {
        return document.getElementById('messageActivityChart') !== null;
    }
}