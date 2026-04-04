/**
 * Uploads a file to Cloudinary using unsigned upload preset.
 * @param {File} file - The file to upload.
 * @returns {Promise<string>} - The secure URL of the uploaded image.
 */
export const uploadToCloudinary = async (file) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ridemate_upload");

    try {
        const response = await fetch(
            "https://api.cloudinary.com/v1_1/dqt6eodgr/image/upload",
            {
                method: "POST",
                body: formData,
            }
        );

        const data = await response.json();

        if (!data.secure_url) {
            console.error("Cloudinary upload failed:", data);
            throw new Error(data.error?.message || "Cloudinary upload failed");
        }

        return data.secure_url;
    } catch (error) {
        console.error("Cloudinary upload catch error:", error);
        throw error;
    }
};
