'use client'
import { useState } from "react";
import { toast } from "sonner";

const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);  // Changed from null to false
  const [error, setError] = useState(null);

  const fn = async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      console.log("🛠 API Response:", response); // ✅ Log API response

      if (!response) {
        throw new Error("Received empty response from API");
      }

      setData(response);
      setError(null);
      return response;
    } catch (err) {
      console.error("❌ API Error:", err);
      setError(err);
      toast.error(err?.message || "Something went wrong!");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, setData, fn };
};

export default useFetch;
