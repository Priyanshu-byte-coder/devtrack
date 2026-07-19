import React from "react";
import ProfileCard from "./ProfileCard";

export default function ProfileCardDemo() {
  return (
    <div style={{ padding: 20 }}>
      <ProfileCard
        name="Vikrant"
        handle="Vikrant0207"
        role="Frontend Engineer"
        bio="Passionate about building delightful UIs and concise developer experiences. Open-source contributor and mentor."
        avatarUrl="https://avatars.githubusercontent.com/u/12345678?v=4"
        socials={[
          { href: "https://github.com/", label: "GitHub" },
          { href: "https://twitter.com/", label: "Twitter" },
          { href: "https://linkedin.com/", label: "LinkedIn" },
        ]}
      />
    </div>
  );
}
