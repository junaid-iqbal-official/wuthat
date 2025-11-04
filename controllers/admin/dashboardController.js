const { Op } = require("sequelize");
const { User, Message, Report, MessageStatus } = require("../../models");
const { sequelize } = require("../../models");

exports.showDashboard = async (req, res) => {
  try {
    // Initialize all widget data
    let dashboardData = {
      // Basic Stats
      userCount: 0,
      totalMessages: 0,
      todayMessages: 0,
      pendingReports: 0,
      totalReports: 0,
      newUsersThisWeek: 0,
      messageGrowth: 0,

      // New Widget Data
      activeUsersToday: 0,
      blockedUsers: 0,
      onlineUsers: 0,
      unreadMessages: 0,
      mediaMessages: 0,
      fileMessages: 0,
      topActiveUsers: [],
      recentRegistrations: [],
      messagesByHour: [],
      popularUsers: [],
      messageTypeStats: [],
      reportTypeStats: [],
      dailyMessageStats: [],
      weeklyUserGrowth: [],
      monthlyStats: {},

      // NEW WIDGETS
      activeConversationsToday: 0,
      peakActivityHour: { hour: 0, count: 0 },

      systemHealth: {
        dbStatus: 'healthy',
        responseTime: 0,
        errorRate: 0
      }
    };

    // Basic user statistics
    try {
      const userResult = await User.findAndCountAll({
        where: {
          role: { [Op.ne]: "admin" },
          status: { [Op.eq]: "active" }
        },
      });
      dashboardData.userCount = userResult.count || 0;
    } catch (error) {
      console.error("Error fetching user count:", error);
    }

    // Active users today (users who sent messages today)
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const activeToday = await Message.findAll({
        attributes: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('sender_id'))), 'count']],
        where: {
          created_at: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        },
        raw: true
      });
      dashboardData.activeUsersToday = activeToday[0]?.count || 0;
    } catch (error) {
      console.error("Error fetching active users today:", error);
    }

    // NEW WIDGET 1: Active Conversations Today
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Count unique conversation pairs (sender-receiver combinations)
      const conversationsQuery = `
        SELECT COUNT(DISTINCT CONCAT(
          LEAST(sender_id, receiver_id), 
          '-', 
          GREATEST(sender_id, receiver_id)
        )) as count
        FROM messages 
        WHERE created_at >= ? AND created_at < ? AND receiver_id IS NOT NULL
      `;

      const conversationResult = await sequelize.query(conversationsQuery, {
        replacements: [today, tomorrow],
        type: sequelize.QueryTypes.SELECT
      });

      dashboardData.activeConversationsToday = conversationResult[0]?.count || 0;
    } catch (error) {
      console.error("Error fetching active conversations:", error);
      dashboardData.activeConversationsToday = 0;
    }

    // Online users (assuming you have last_active field)
    try {
      dashboardData.onlineUsers = await User.count({
        where: {
          role: { [Op.ne]: "admin" },
          status: 'active',
          is_online: 1
        }
      }) || 0;
    } catch (error) {
      console.error("Error fetching online users (last_active field might not exist):", error);
      dashboardData.onlineUsers = 0;
    }

    // Blocked users
    try {
      dashboardData.blockedUsers = await User.count({
        where: {
          role: { [Op.ne]: "admin" },
          status: 'blocked'
        }
      }) || 0;
    } catch (error) {
      console.error("Error fetching blocked users:", error);
    }

    // Message statistics
    try {
      dashboardData.totalMessages = await Message.count() || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      dashboardData.todayMessages = await Message.count({
        where: {
          created_at: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        }
      }) || 0;

      // Media messages (images, videos)
      dashboardData.mediaMessages = await Message.count({
        where: {
          message_type: {
            [Op.in]: ['image', 'video', 'audio']
          }
        }
      }) || 0;

      // File messages (documents, files)
      dashboardData.fileMessages = await Message.count({
        where: {
          message_type: {
            [Op.in]: ['file', 'document']
          }
        }
      }) || 0;

      // Unread messages (if MessageStatus model exists)
      try {
        dashboardData.unreadMessages = await MessageStatus.count({
          where: {
            status: 'sent'
          }
        }) || 0;
      } catch (error) {
        console.log("MessageStatus model not available, skipping unread count");
        dashboardData.unreadMessages = 0;
      }
    } catch (error) {
      console.error("Error fetching message stats:", error);
    }

    // Top active users
    try {
      const topUsers = await Message.findAll({
        attributes: [
          'sender_id',
          [sequelize.fn('COUNT', sequelize.col('sender_id')), 'message_count']
        ],
        include: [{
          model: User,
          as: 'sender',
          attributes: ['name', 'email', 'avatar']
        }],
        group: ['sender_id'],
        order: [[sequelize.fn('COUNT', sequelize.col('sender_id')), 'DESC']],
        limit: 5,
        raw: false
      });
      dashboardData.topActiveUsers = topUsers || [];
    } catch (error) {
      console.error("Error fetching top active users:", error);
    }

    // Recent user registrations
    try {
      dashboardData.recentRegistrations = await User.findAll({
        where: {
          role: { [Op.ne]: "admin" }
        },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'name', 'email', 'created_at', 'status']
      }) || [];
    } catch (error) {
      console.error("Error fetching recent registrations:", error);
    }

    // Messages by hour (24-hour activity)
    try {
      const hourlyMessages = await sequelize.query(`
        SELECT 
          HOUR(created_at) as hour,
          COUNT(*) as count
        FROM messages 
        WHERE DATE(created_at) = CURDATE()
        GROUP BY HOUR(created_at)
        ORDER BY hour ASC
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      // Fill missing hours with 0
      dashboardData.messagesByHour = [];
      for (let i = 0; i < 24; i++) {
        const hourData = hourlyMessages.find(h => h.hour === i);
        dashboardData.messagesByHour.push({
          hour: i,
          count: hourData ? hourData.count : 0
        });
      }

      // Find peak activity hour
      const peakHour = dashboardData.messagesByHour.reduce((max, current) => {
        return current.count > max.count ? current : max;
      }, { hour: 0, count: 0 });

      dashboardData.peakActivityHour = peakHour;

    } catch (error) {
      console.error("Error fetching hourly messages:", error);
      // create 24 hours with 0 counts
      dashboardData.messagesByHour = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: 0
      }));
      dashboardData.peakActivityHour = { hour: 0, count: 0 };
    }

    // Weekly user growth
    try {
      const weeklyGrowth = await sequelize.query(`
        SELECT 
          WEEK(created_at) as week,
          YEAR(created_at) as year,
          COUNT(*) as count
        FROM users 
        WHERE role != 'admin' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
        GROUP BY YEAR(created_at), WEEK(created_at)
        ORDER BY year DESC, week DESC
        LIMIT 8
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      dashboardData.weeklyUserGrowth = weeklyGrowth || [];
    } catch (error) {
      console.error("Error fetching weekly growth:", error);
    }

    // Monthly statistics
    try {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const monthlyUsers = await User.count({
        where: {
          role: { [Op.ne]: "admin" },
          created_at: {
            [Op.gte]: currentMonth,
            [Op.lt]: nextMonth
          }
        }
      });

      const monthlyMessages = await Message.count({
        where: {
          created_at: {
            [Op.gte]: currentMonth,
            [Op.lt]: nextMonth
          }
        }
      });

      const monthlyReports = await Report.count({
        where: {
          created_at: {
            [Op.gte]: currentMonth,
            [Op.lt]: nextMonth
          }
        }
      });

      dashboardData.monthlyStats = {
        users: monthlyUsers || 0,
        messages: monthlyMessages || 0,
        reports: monthlyReports || 0
      };
    } catch (error) {
      console.error("Error fetching monthly stats:", error);
      dashboardData.monthlyStats = { users: 0, messages: 0, reports: 0 };
    }

    // System health metrics
    try {
      const startTime = Date.now();
      await sequelize.authenticate();
      const endTime = Date.now();

      dashboardData.systemHealth = {
        dbStatus: 'healthy',
        responseTime: endTime - startTime,
        errorRate: 0
      };
    } catch (error) {
      console.error("Error checking system health:", error);
      dashboardData.systemHealth = {
        dbStatus: 'error',
        responseTime: 0,
        errorRate: 100
      };
    }

    // Get existing stats (reports, growth, etc.)
    try {
      // Reports
      dashboardData.pendingReports = await Report.count({
        where: { status: 'pending' }
      }) || 0;

      dashboardData.totalReports = await Report.count() || 0;

      // New users this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      dashboardData.newUsersThisWeek = await User.count({
        where: {
          role: { [Op.ne]: "admin" },
          created_at: { [Op.gte]: weekAgo }
        }
      }) || 0;

      // Message type stats
      dashboardData.messageTypeStats = await Message.findAll({
        attributes: [
          'message_type',
          [sequelize.fn('COUNT', sequelize.col('message_type')), 'count']
        ],
        group: ['message_type'],
        raw: true
      }) || [];

      // Report type stats
      dashboardData.reportTypeStats = await Report.findAll({
        attributes: [
          'report_type',
          [sequelize.fn('COUNT', sequelize.col('report_type')), 'count']
        ],
        group: ['report_type'],
        raw: true
      }) || [];

      // Daily message stats
      dashboardData.dailyMessageStats = await sequelize.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM messages 
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, {
        type: sequelize.QueryTypes.SELECT
      }) || [];

      // Calculate growth percentages
      const lastWeekStart = new Date();
      lastWeekStart.setDate(lastWeekStart.getDate() - 14);
      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - 7);

      const lastWeekMessages = await Message.count({
        where: {
          created_at: {
            [Op.gte]: lastWeekStart,
            [Op.lt]: thisWeekStart
          }
        }
      }) || 0;

      const thisWeekMessages = await Message.count({
        where: {
          created_at: {
            [Op.gte]: thisWeekStart
          }
        }
      }) || 0;

      dashboardData.messageGrowth = lastWeekMessages > 0
        ? Math.round(((thisWeekMessages - lastWeekMessages) / lastWeekMessages) * 100)
        : 0;

    } catch (error) {
      console.error("Error fetching additional stats:", error);
    }

    res.render("admin/dashboard/index", {
      layout: "admin/layouts/index",
      title: "Dashboard",
      ...dashboardData
    });

  } catch (error) {
    // Return basic fallback data
    res.render("admin/dashboard/index", {
      layout: "admin/layouts/index",
      title: "Dashboard",
      userCount: 0,
      totalMessages: 0,
      todayMessages: 0,
      pendingReports: 0,
      totalReports: 0,
      newUsersThisWeek: 0,
      activeUsersToday: 0,
      blockedUsers: 0,
      onlineUsers: 0,
      unreadMessages: 0,
      mediaMessages: 0,
      fileMessages: 0,
      activeConversationsToday: 0,
      peakActivityHour: { hour: 0, count: 0 },
      topActiveUsers: [],
      recentRegistrations: [],
      messagesByHour: [],
      messageTypeStats: [],
      reportTypeStats: [],
      dailyMessageStats: [],
      weeklyUserGrowth: [],
      monthlyStats: { users: 0, messages: 0, reports: 0 },
      systemHealth: { dbStatus: 'error', responseTime: 0, errorRate: 100 },
      messageGrowth: 0,
      error: "Unable to load dashboard data"
    });
  }
};