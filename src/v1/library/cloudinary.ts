import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";


dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath: string, folder: string = "uploads"): Promise<{ url: string; publicId: string } | null> => {
  try {
    if (!fs.existsSync(localFilePath)) {
      console.error("File not found before upload:", localFilePath);
      return null;
    }

    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "image",
      folder: folder,
    });

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return { url: result.secure_url, publicId: result.public_id }; 
  } catch (error) {
    console.error("Cloudinary upload error:", error);

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null;
  }
};


export const extractPublicIdFromUrl = (imageUrl: string): string | null => {
  try {
    const urlParts = imageUrl.split("/");
    const fileName = urlParts.pop()?.split(".")[0]; 

    
    const uploadIndex = urlParts.indexOf("upload") + 1;
    if (uploadIndex > 0 && fileName) {
      let publicId = urlParts.slice(uploadIndex).join("/") + "/" + fileName;

      const parts = publicId.split("/");
      if (parts[0].startsWith("v")) {
        parts.shift(); 
      }
      return parts.join("/");
    }

    return null;
  } catch (error) {
    console.error("Error extracting public_id:", error);
    return null;
  }
};





export const deleteFromCloudinary = async (publicId: string) => {
  try {
    if (!publicId) {
      console.warn("⚠️ No public ID provided for deletion.");
      return null;
    }

    // Attempt to delete the image from Cloudinary
    const response = await cloudinary.uploader.destroy(publicId, {
      invalidate: true, // Removes from CDN cache
      resource_type: "image",
    });

    console.log("✅ Cloudinary Delete Response:", response);

    if (response.result === "not found") {
      console.warn("⚠️ Cloudinary image already deleted or not found:", publicId);
    }

    return response;
  } catch (error:any) {
    console.error("❌ Error deleting from Cloudinary:", error);
    throw new Error(error.message || "Failed to delete file from Cloudinary");
  }
};




