
import { motion } from 'motion/react';
import { ASSET_PATHS } from '../assets/assetPaths';
import { useState } from 'react';

interface UserCharacterProps {
  hasPaper: boolean;
}

export default function UserCharacter({ hasPaper }: UserCharacterProps) {
  const [imgError, setImgError] = useState(false);
  const userImg = ASSET_PATHS.characters.user.withPaper;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className={`${hasPaper && userImg && !imgError ? 'w-20 h-20' : 'w-14 h-14 bg-[#d87965] border-4 border-[#7b5835] shadow-[4px_4px_0px_0px_rgba(80,53,33,0.25)]'} flex items-center justify-center text-3xl overflow-visible`}>
          {hasPaper && userImg && !imgError ? (
            <img 
              src={userImg} 
              alt="User" 
              className="w-full h-full object-contain pixelated" 
              onError={() => {
                console.error(`Failed to load user image at ${userImg}`);
                setImgError(true);
              }}
              referrerPolicy="no-referrer"
            />
          ) : (
             <span className="pixel-sprite sprite-rose" />
          )}
        </div>
        {hasPaper && (!userImg || imgError) && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-4 top-2 w-10 h-12 bg-white border-2 border-gray-400 rotate-12 flex items-center justify-center shadow-sm"
          >
            <div className="flex flex-col gap-1 w-full px-1">
              <div className="h-0.5 bg-gray-200 w-full" />
              <div className="h-0.5 bg-gray-200 w-3/4" />
              <div className="h-0.5 bg-gray-200 w-full" />
            </div>
            <div className="absolute top-0 right-0 border-r-[10px] border-r-transparent border-t-[10px] border-t-gray-200" />
          </motion.div>
        )}
      </div>
      <div className="mt-2 text-sm bg-[#fff8e6]/90 px-2 py-0.5 border border-[#7b5835]/30 text-[#503521]">
        Scholar
      </div>
    </div>
  );
}
