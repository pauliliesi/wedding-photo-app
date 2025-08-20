import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add the images configuration here
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'argmkkmhpzdakymbeuhi.supabase.co', // YOUR_SUPABASE_PROJECT_ID.supabase.co
        // You can be more specific with port and pathname if needed, but usually not for Supabase storage
        // port: '',
        // pathname: '/storage/v1/object/public/wedding-photos/**', // Optional: Restrict to your bucket path
      },
      // You can add other trusted hostnames here if needed in the future
      // {
      //   protocol: 'https',
      //   hostname: 'another-image-provider.com',
      // },
    ],
  }
};

export default nextConfig;
