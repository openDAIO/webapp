
import React, { useState } from 'react';

interface ProjectRoomProps {
  label: string;
  position: string;
  imageUrl?: string;
  inactive?: boolean;
}

const ProjectRoom: React.FC<ProjectRoomProps> = ({ label, position, imageUrl, inactive = false }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`project-room absolute -translate-x-1/2 -translate-y-1/2 w-60 h-60 flex flex-col items-center justify-center z-10 ${inactive ? 'project-room--inactive' : ''} ${position}`}>
      <div className="relative w-full h-full flex items-center justify-center group overflow-visible">
        {imageUrl && !imgError ? (
          <img 
            src={imageUrl} 
            alt={label} 
            className="project-room__image h-[172px] w-auto max-w-none object-contain pixelated drop-shadow-[8px_8px_0_rgba(38,33,29,0.28)]"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center border-4 border-dashed border-white/10 bg-white/5">
             <div className="w-16 h-16 border-2 border-white/5 rounded-full" />
          </div>
        )}
        
      </div>
    </div>
  );
};

export default ProjectRoom;
