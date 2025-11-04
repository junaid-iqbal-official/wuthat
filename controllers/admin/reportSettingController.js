const { ReportSetting } = require("../../models");
const { Op } = require("sequelize");

exports.showReportSetting = async (req, res) => {
    res.render("admin/report-setting/report", {
      layout: "admin/layouts/index",
      title: "Report Setting",
      error: null
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

    // where condition based on search parameter
    const where = search
      ? {
          [Op.or]: [{ title: { [Op.like]: `%${search}%` } }],
        }
      : {};

    // fetch all FAQ without limit and offset
    const allReports = await ReportSetting.findAll({
      where,
      order: [[sortField, sortOrder]],
    });

    const { count, rows: reports } = await ReportSetting.findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json({
      items: reports,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: allReports.length,
    });
  } catch (error) {
    console.error("Error in fetch Report data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};

exports.createReport = async (req,res) => {
  try {
    const {title} = req.body;

    await ReportSetting.create({title});
    return res.redirect('/admin/report')

  } catch (error) {
    console.error("Error in create Report", error);

    req.session.error = "Internal Server Error.";
    res.redirect('/admin/report');
  }
}

exports.editReport = async (req,res) => {
  const {title,id} = req.body;
  
  try {
    if(!id){
      return res.status(404).json({message:"Report Id is not provided",success:false});
    }

    const report = await ReportSetting.findByPk(id);
    if(!report){
      return res.status(404).json({message:"Report not found.",success:false});
    }

    await report.update({title});

    return res.status(201).json({success:true,report:report.toJSON()});
  } catch (error) {
    console.error("Error in update report data", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
}

exports.deleteReport = async(req,res) =>{
  const {id} = req.body;
  
  try {

    if(!id){
      return res.status(404).json({message:"Report Id is not provided",success:false});
    }

    const report = await ReportSetting.findByPk(id);
    if(!report){
      return res.status(404).json({message:"report not found.",success:false});
    }

    await report.destroy();
    return res.status(201).json({success:true});
  } catch (error) {
    console.error("Error in delete report data", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
}