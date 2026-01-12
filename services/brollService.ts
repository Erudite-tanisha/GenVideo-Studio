export interface StockVideoResponse {
    videoUrl: string;
    matchedTags: string[];
    score?: number;
  }
  
  export async function fetchStockVideo(
    script: string
  ): Promise<StockVideoResponse> {
    const res = await fetch("http://localhost:8000/api/get-broll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ script }),
    });
  
    if (!res.ok) {
      throw new Error("Failed to fetch stock video");
    }
  
    return res.json();
  }
  