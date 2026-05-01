
import { TABLE_CONFIG } from '../constants/uiConfig';
import { REVIEW_ROOM_SCENES, type ConferenceHallTiles } from '../constants/reviewRoomScenes';

const TOP_BLOCK_BAND_HEIGHT = 22 * 7;
const TILE_SIZE = 22;
const shiftedTop = (top: number) => `${top + TOP_BLOCK_BAND_HEIGHT}px`;
const hexAlpha = (hexColor: string, alphaHex: string) => `${hexColor}${alphaHex}`;

interface ConferenceHallProps {
  tiles?: ConferenceHallTiles;
}

const DEFAULT_TILES = REVIEW_ROOM_SCENES.paper.tiles;

export default function ConferenceHall({ tiles = DEFAULT_TILES }: ConferenceHallProps) {
  const dividerWidth = `${(tiles.dividerColumns ?? 11) * TILE_SIZE}px`;

  return (
    <div className="absolute inset-0 z-0">
      {/* The main hall floor keeps the existing room layout while shifting the mood warmer. */}
      <div className="w-full h-full overflow-hidden relative" style={{ backgroundColor: tiles.floorColor }}>
         <div 
           className="absolute inset-0 opacity-100"
           style={{
             backgroundImage: `url("${tiles.floor}")`,
             backgroundSize: '22px 22px'
           }}
         />

         {/* Subtle depth gradient for the floor */}
         <div
           className="absolute inset-0"
           style={{
             backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, 0.2), transparent, ${hexAlpha(tiles.depthTint, '33')})`,
           }}
         />

         {/* Soft edge shading */}
         <div
           className="absolute inset-y-0 left-0 w-24"
           style={{
             backgroundImage: `linear-gradient(to right, ${hexAlpha(tiles.edgeTint, '33')}, transparent)`,
           }}
         />
         <div
           className="absolute inset-y-0 right-0 w-24"
           style={{
             backgroundImage: `linear-gradient(to left, ${hexAlpha(tiles.edgeTint, '33')}, transparent)`,
           }}
         />

         {/* Vertical Block Walls */}
         <div 
           className="absolute inset-y-0 left-0 w-6" 
           style={{ 
             backgroundImage: `url("${tiles.wall}")`,
             backgroundSize: '22px 22px',
             backgroundRepeat: 'repeat-y'
           }} 
         />
         <div 
           className="absolute inset-y-0 right-0 w-5" 
           style={{ 
             backgroundImage: `url("${tiles.wall}")`,
             backgroundSize: '22px 22px',
             backgroundRepeat: 'repeat-y'
           }} 
         />

         {/* Horizontal Block Rows - Between Left Rooms (Node A & F) */}
         <div 
           className="absolute left-[22px] h-[44px] z-10"
           style={{ 
             top: shiftedTop(198),
             width: dividerWidth,
             backgroundImage: `url("${tiles.divider}")`,
             backgroundSize: '22px 22px',
             backgroundRepeat: 'repeat'
           }} 
         />{/* Horizontal Block Rows - Between Left Rooms (Node F & C) */}
         <div 
           className="absolute left-[22px] h-[44px] z-10"
           style={{ 
             top: shiftedTop(376),
             width: dividerWidth,
             backgroundImage: `url("${tiles.divider}")`,
             backgroundSize: '22px 22px',
             backgroundRepeat: 'repeat'
           }} 
         />

         {/* Horizontal Block Rows - Between Right Rooms (Node B & D) */}
         <div 
           className="absolute right-[22px] h-[44px] z-10"
           style={{ 
             top: shiftedTop(198),
             width: dividerWidth,
             backgroundImage: `url("${tiles.divider}")`,
             backgroundSize: '22px 22px',
             backgroundRepeat: 'repeat'
           }} 
         />
         {/* Horizontal Block Rows - Between Right Rooms (Node E & D) */}
         <div 
           className="absolute right-[22px] h-[44px] z-10"
           style={{ 
             top: shiftedTop(376),
             width: dividerWidth,
             backgroundImage: `url("${tiles.divider}")`,
             backgroundSize: '22px 22px',
             backgroundRepeat: 'repeat'
           }} 
         />
      </div>

      {/* Central Table - Image from SVG */}
      <div 
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
        style={{
          top: `${TABLE_CONFIG.y}%`,
          left: `${TABLE_CONFIG.x}%`,
          width: `${TABLE_CONFIG.width}px`,
          height: `${TABLE_CONFIG.height}px`
        }}
      >
        <img 
          src="/assets/backgrounds/conference-hall/central-table.svg" 
          alt="Central Table" 
          className="w-full h-full object-contain drop-shadow-2xl"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
