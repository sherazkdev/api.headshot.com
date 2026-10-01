import type { VisionImageInput } from "./types.js";

export const MOCK_BRANDING = {
  overallScore: 72,
  overallLabel: "Good",
  percentileLabel: "Top 40%",
  metrics: [
    { id: "clarity", score: 75, rating: "Good", insight: "Subject is sharp and well framed." },
    { id: "professionalism", score: 70, rating: "Good", insight: "Outfit reads professional." },
    { id: "composition", score: 68, rating: "Fair", insight: "Slightly more headroom would help." },
    { id: "lighting", score: 74, rating: "Good", insight: "Even studio light, mild shadow on one side." },
    { id: "approachability", score: 73, rating: "Good", insight: "Expression is confident and open." },
  ],
  improvementTips: ["Soften the background", "Lift shadows under the chin"],
  strengths: ["Eye contact", "Clean clothing"],
  enhancementPrompt: "Keep the same person. Improve lighting evenness, clean the background, sharpen eyes.",
};

export function mockProfileReview(images: VisionImageInput[]) {
  return {
    overallScore: 82,
    overallLabel: "Good",
    summary:
      "Photo 1 is the stronger professional headshot: lighting is even, skin tones look natural, and the crop feels LinkedIn-ready. Photo 2 is usable but weaker on color and crop. Use photo 1 as the primary profile image and keep photo 2 as a backup.",
    comparison:
      "Photo 1 wins on lighting, color accuracy, and professional framing. Photo 2 has more mood but a stronger color cast and a tighter crop that feels less corporate.",
    recommendation: "Use photo 1 for LinkedIn, resume, and company profiles.",
    bestPhotoReason: "Photo 1 has cleaner light, natural skin tone, and a more professional expression.",
    strengths: ["Even lighting on the face", "Natural skin tones", "Clear subject focus"],
    weaknesses: ["Secondary photo has a cool color cast", "Background could be simpler"],
    improvementTips: [
      "Reduce colored gel or window spill so skin stays warm and natural.",
      "Leave a bit more headroom and keep eyes on the upper third.",
    ],
    metrics: [
      { id: "lighting", label: "Lighting", score: 84, rating: "Good", insight: "Key light is even on the face with only mild shadow." },
      { id: "composition", label: "Composition & framing", score: 80, rating: "Good", insight: "Head and shoulders sit comfortably in frame." },
      { id: "background", label: "Background", score: 78, rating: "Good", insight: "Background is mostly clean and not competing with the face." },
      { id: "clothing", label: "Clothing & grooming", score: 81, rating: "Good", insight: "Outfit reads professional and uncluttered." },
      { id: "expression", label: "Expression & eye contact", score: 83, rating: "Good", insight: "Expression is open and camera-facing." },
      { id: "sharpness", label: "Sharpness & image quality", score: 85, rating: "Excellent", insight: "Eyes and fabric detail are crisp." },
      { id: "color", label: "Color & skin tone", score: 76, rating: "Good", insight: "Primary photo is accurate; the alternate has a cool cast." },
      { id: "professionalism", label: "Professionalism", score: 82, rating: "Good", insight: "Overall look is suitable for LinkedIn and resume use." },
    ],
    useCases: {
      linkedin: { photoIndex: 0, reason: "Cleanest professional framing and natural color." },
      resume: { photoIndex: 0, reason: "Most conservative and employer-safe option." },
      company: { photoIndex: 0, reason: "Looks like a studio headshot for a team page." },
      social: { photoIndex: 1, reason: "Slightly more mood if you want a warmer personal brand." },
    },
    photos: images.map((_, index) => ({
      index,
      score: 80 - index * 4,
      rating: index === 0 ? "Good" : "Fair",
      verdict: index === 0 ? "Best professional option" : "Backup / moodier option",
      summary:
        index === 0
          ? "This frame has even light, natural skin tone, and a professional crop. It is the safest choice for LinkedIn and resume use."
          : "This frame is sharp but cooler in color and a bit tighter. It works as an alternate, not the primary corporate photo.",
      factors: ["lighting", "expression", "color"],
      strengths: ["Clear face", "Strong subject focus"],
      weaknesses: ["Minor crop", "Color cast on the secondary frame"],
      improvementTips: ["Soften colored light on the face", "Leave a little more space above the head"],
      recommendedFor: index === 0 ? ["linkedin", "resume", "company"] : ["social"],
      metrics: [
        { id: "lighting", score: 84 - index * 6, rating: "Good", insight: "Face is well lit with only small shadow under the chin." },
        { id: "composition", score: 80 - index * 4, rating: "Good", insight: "Head-and-shoulders crop is close to standard headshot framing." },
        { id: "background", score: 78 - index * 3, rating: "Good", insight: "Background stays secondary to the subject." },
        { id: "clothing", score: 81, rating: "Good", insight: "Wardrobe looks neat and professional." },
        { id: "expression", score: 83 - index * 2, rating: "Good", insight: "Eye contact is direct and approachable." },
        { id: "sharpness", score: 85, rating: "Excellent", insight: "Focus on the eyes is clean." },
        { id: "color", score: 88 - index * 12, rating: index === 0 ? "Excellent" : "Fair", insight: "Skin tone is more natural on the first frame." },
        { id: "professionalism", score: 82 - index * 5, rating: "Good", insight: "Reads as a professional profile photo." },
      ],
    })),
    bestIndex: 0,
    bestScore: 80,
  };
}
