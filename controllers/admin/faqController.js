const { Faq } = require("../../models");
const { Op } = require("sequelize");

exports.showFaq = async (req, res) => {
  res.render("admin/faq/index", {
    layout: "admin/layouts/index",
    title: "FAQ's",
    error: null
  });
};

exports.faqs = async (req, res) => {
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
    const allFaq = await Faq.findAll({
      where,
      order: [[sortField, sortOrder]],
    });

    const { count, rows: faqs } = await Faq.findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json({
      items: faqs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: allFaq.length,
    });
  } catch (error) {
    console.error("Error in fetch FAQ data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};

exports.createFaq = async (req,res) => {
  try {
    const {title,description} = req.body;

    const existing = await Faq.findOne({where:{title}});
    if(existing){
      req.session.error = "FAQ already Exists.";
      return res.redirect('/admin/faq');
    }

    await Faq.create({title,description,status:req.body.faqStatus ? true : false});
    return res.redirect('/admin/faq')

  } catch (error) {
    console.error("Error in create FAQ", error);

    req.session.error = "Internal Server Error.";
    res.redirect('/admin/faq');
  }
}

exports.editFaq = async (req,res) => {
  const {title,description,id} = req.body;
  
  try {
    if(!id){
      return res.status(404).json({message:"FAQ Id is not provided",success:false});
    }

    const faq = await Faq.findByPk(id);
    if(!faq){
      return res.status(404).json({message:"FAQ not found.",success:false});
    }

    if(title !== faq.title){
      const existing = await Faq.findOne({where:{title:title}});
      if(existing){
        return res.status(404).json({message:"FAQ already exist of this question. Try another.",success:false});
      }
    }

    await faq.update({title,description,status:req.body.status ? true : false});
    return res.status(201).json({success:true,faq:faq.toJSON()});
  } catch (error) {
    console.error("Error in update FAQ data", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
}

exports.deleteFaq = async(req,res) =>{
  const {id} = req.body;
  
  try {

    if(!id){
      return res.status(404).json({message:"FAQ Id is not provided",success:false});
    }

    const faq = await Faq.findByPk(id);
    if(!faq){
      return res.status(404).json({message:"FAQ not found.",success:false});
    }

    await faq.destroy();
    return res.status(201).json({success:true});
  } catch (error) {
    console.error("Error in delete FAQ data", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
}

exports.updateStatus = async (req,res) =>{
  const {id,status} = req.body;

  try {

    if(!id){
      return res.status(404).json({message:"FAQ Id is not provided",success:false});
    }

    const faq = await Faq.findByPk(id);
    if(!faq){
      return res.status(404).json({message:"FAQ not found.",success:false});
    }

    await faq.update({status:status ? false :true});
    return res.status(201).json({success:true});
    
  } catch (error) {
    console.error("Error in update FAQ status", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
  
}