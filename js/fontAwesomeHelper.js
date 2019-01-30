const {library, icon, findIconDefinition} = require('@fortawesome/fontawesome-svg-core');
const {fas} = require('@fortawesome/free-solid-svg-icons');

library.add(fas);

function drawFontAwesomeIcon(node, ctx, iconName, x, y, size, color = "white", prefix = "far") {
    let def = findIconDefinition({prefix: prefix, iconName: iconName});
    if (!def) return;
    let icn = icon(def, {
        transform: {
            // can't use scale here, as that apparently only affects CSS not the actual path data
        }
    });
    ctx.fillStyle = color;
    let path = new Path2D(icn.icon[4]);
    // path.moveTo(x, y);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fill(path);
    ctx.restore();
}

function handleDrawTitleBox(ctx, titleHeight, size, scale) {
    if (!this.iconName) return;
    if (scale > 0.5) {
        drawFontAwesomeIcon(this, ctx, this.iconName, 4, -titleHeight + 4, 0.025, this.iconColor || "white", this.iconPrefix || "fas")
    }
}

module.exports = {drawFontAwesomeIcon, handleDrawTitleBox};