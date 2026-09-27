import React from "react";

const SkipToContent = () => {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-6 focus:py-3 focus:rounded-lg focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-ring"
    >
      דלג לתוכן המרכזי
    </a>
  );
};

export default SkipToContent;
