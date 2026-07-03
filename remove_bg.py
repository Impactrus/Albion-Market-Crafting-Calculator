"""Aggressively remove background from druid mascot - very low threshold."""
from PIL import Image
from collections import deque

def remove_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    
    visited = set()
    
    def is_bg_color(r, g, b, a):
        """Very aggressive: anything lighter than medium gray is background"""
        # Check if it's a light/neutral color (not saturated)
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        saturation = max_c - min_c
        brightness = (r + g + b) / 3
        
        # Light and not very colorful = background
        if brightness > 140 and saturation < 80:
            return True
        # Very light regardless of saturation
        if brightness > 200:
            return True
        return False
    
    # Start flood fill from ALL edge pixels
    queue = deque()
    
    for x in range(w):
        for border_y in [0, 1, 2, h-1, h-2, h-3]:
            r, g, b, a = pixels[x, border_y]
            if is_bg_color(r, g, b, a):
                queue.append((x, border_y))
    
    for y in range(h):
        for border_x in [0, 1, 2, w-1, w-2, w-3]:
            r, g, b, a = pixels[border_x, y]
            if is_bg_color(r, g, b, a):
                queue.append((border_x, y))
    
    # BFS flood fill
    while queue:
        x, y = queue.popleft()
        
        if (x, y) in visited:
            continue
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
            
        r, g, b, a = pixels[x, y]
        
        if not is_bg_color(r, g, b, a):
            continue
        
        visited.add((x, y))
        pixels[x, y] = (0, 0, 0, 0)  # Fully transparent
        
        # 8-directional neighbors
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x+dx, y+dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    queue.append((nx, ny))
    
    # Anti-alias pass: soften edges between transparent and opaque
    result = img.copy()
    rp = result.load()
    
    for y in range(h):
        for x in range(w):
            if (x, y) not in visited:
                # Count transparent neighbors in 3x3 area
                trans_count = 0
                total = 0
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        nx, ny = x+dx, y+dy
                        if 0 <= nx < w and 0 <= ny < h:
                            total += 1
                            if (nx, ny) in visited:
                                trans_count += 1
                
                if trans_count > 0 and total > 0:
                    r, g, b, a = pixels[x, y]
                    ratio = trans_count / total
                    new_alpha = int(a * (1.0 - ratio * 0.7))
                    rp[x, y] = (r, g, b, max(0, new_alpha))
    
    result.save(output_path, "PNG")
    print(f"Done! Removed {len(visited)} bg pixels out of {w*h} ({100*len(visited)//w//h}% of image)")

if __name__ == "__main__":
    # Use ORIGINAL source image (not already-processed one)
    remove_bg("web/druid_mascot_original.png", "web/druid_mascot.png")
