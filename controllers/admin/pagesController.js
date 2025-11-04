const { PageContent } = require("../../models");
const sanitizeHtml = require("sanitize-html");

exports.showPages = async (req, res) => {
  let privacyPage = null;
  let termsPage = null;

  try {
    privacyPage = await PageContent.findOne({
      where: { slug: "privacy-policy" },
      attributes: ["id", "title", "slug", "content", "status"], // Only request safe fields
    });
  } catch (err) {
    console.warn("Privacy policy fetch failed:", err.message);
  }

  try {
    termsPage = await PageContent.findOne({
      where: { slug: "terms-and-conditions" },
      attributes: ["id", "title", "slug", "content", "status"],
    });
  } catch (err) {
    console.warn("Terms & Conditions fetch failed:", err.message);
  }
  
  return res.render("admin/pages", {
    layout: "admin/layouts/index",
    title: "Pages",
    privacy: privacyPage || null,
    terms: termsPage || null,
  });
};

exports.updatePages = async (req, res) => {
  const { slug } = req.body;
  let content = req.body.content;
  
  try {
    if (!slug) {
      return res.status(404).json({ success: false, message: "Please provide Slug" });
    }

    const exist = await PageContent.findOne({ where: { slug } });
    if (!exist) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    content = sanitizeHtml(content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
      allowedAttributes: {
        "*": ["style", "class"],
        a: ["href", "target"],
        img: ["src", "alt"],
      },
    });

    await exist.update({ content });
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error in edit group Member Limit", error);
    return res.status(201).json({ success: false, message:"Error in edit group Member Limit"});
  }
};
