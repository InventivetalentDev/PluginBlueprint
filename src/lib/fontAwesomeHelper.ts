import {library, icon, findIconDefinition} from '@fortawesome/fontawesome-svg-core';
import {fas} from '@fortawesome/free-solid-svg-icons';
import type {IconName, IconPrefix} from '@fortawesome/fontawesome-svg-core';
import type {LGraphNode, Vector2} from '../../assets/lib/litegraph/litegraph';

library.add(fas);

function drawFontAwesomeIcon(node: LGraphNode, ctx: CanvasRenderingContext2D, iconName: IconName, x: number, y: number, size: number, color = "white", prefix: IconPrefix = "far") {
    let def = findIconDefinition({prefix: prefix, iconName: iconName});
    if (!def) return;
    let icn = icon(def, {
        transform: {
            // can't use scale here, as that apparently only affects CSS not the actual path data
        }
    });
    ctx.fillStyle = color;
    let path = new Path2D(icn.icon[4] as string);
    // path.moveTo(x, y);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fill(path);
    ctx.restore();
}

function handleDrawTitleBox(this: LGraphNode, ctx: CanvasRenderingContext2D, titleHeight: number, size: Vector2, scale: number) {
    if (!this.iconName) return;
    if (scale > 0.5) {
        drawFontAwesomeIcon(this, ctx, this.iconName, 4, -titleHeight + 4, 0.025, this.iconColor || "white", this.iconPrefix || "fas")
    }
}

export {drawFontAwesomeIcon, handleDrawTitleBox};
