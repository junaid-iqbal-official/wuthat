const { ReportContact, User, sequelize } = require("../../models");
const { Op } = require("sequelize");

exports.showReport = async (req, res) => {
  const error = null;

  let statusOptions = [];
  try {
    const [result] = await sequelize.query(`
      SELECT COLUMN_TYPE AS enumType
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reports'
        AND COLUMN_NAME = 'status'
    `);

    if (result.length > 0) {
      const enumType = result[0].enumType;
      statusOptions = enumType.match(/enum\((.*)\)/i)?.[1]
        .split(',')
        .map(val => val.replace(/'/g, '')) || [];
    }
  } catch (err) {
    console.error('Failed to fetch enum options:', err);
  }

  res.render("admin/contact-report/report-list", {
    layout: "admin/layouts/index",
    title: "Reported Accounts",
    statusOptions,
    error
  });
};

exports.reports = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
    
        const search = req.query.search || "";
        const sortField = req.query.sortField || "id";
        const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

        const includeModal = [
            {
              model: User,
              as: "reporter",
              attributes: ["id", "name"]
            },
            {
              model: User,
              as: "reported_user",
              attributes: ["id", "name"]
            },
            {
              model: User,
              as: "resolver",
              attributes: ["id", "name"]
            }
        ];
        const where = search
        ? {
            [Op.or]: [
              { description: { [Op.like]: `%${search}%` } },
              { report_type: { [Op.like]: `%${search}%` } },
              { status: { [Op.like]: `%${search}%` } },
              { admin_notes: { [Op.like]: `%${search}%` } },
            ],
          }
        : {};      
        
        const allReports = await ReportContact.findAndCountAll({
        where,
        order: [[sortField, sortOrder]],
        include: includeModal
        });
    
        const { count, rows: reports } = await ReportContact.findAndCountAll({
          where,
          order: [[sortField, sortOrder]],
          limit,
          offset,
          include: includeModal
        });
        
        res.json({
          items: reports,
          totalPages: Math.ceil(count / limit),
          currentPage: page,
          itemCount: allReports.count,
        });
    
    } catch (error) {
        console.error("Error in fetchReports:", error);
        res.status(403).json({ message: "Internal Server Error." });
    }
};

exports.editReport = async (req, res) => {
    const { admin_notes, status, id } = req.body;
  
    try {
      if (!id) {
        return res.status(400).json({ success: false, message: "Report ID is missing." });
      }
  
      const report = await ReportContact.findByPk(id);
      if (!report) {
        return res.status(404).json({ success: false, message: "Report not found." });
      }
  
      const resolved_by = req.session?.userId
  
      await report.update({
        admin_notes,
        status,
        resolved_by: resolved_by || null,
        resolved_at: new Date()
      });
  
      return res.status(200).json({
        success: true,
        message: "Report updated successfully.",
        report: report.toJSON()
      });
  
    } catch (error) {
      console.error("Error editing report:", error);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
};
  