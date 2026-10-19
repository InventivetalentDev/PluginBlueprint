export interface PickerItem {
    value: string;
    label: string;
    detail?: string;
    note?: string;
    group?: string;
}

let closePicker: (() => void) | undefined;

export function openPicker(options: {
    x: number;
    y: number;
    placeholder: string;
    items?: PickerItem[];
    search?: (query: string) => PickerItem[];
    onPick: (value: string) => void;
}): void {
    closePicker?.();
    const previousFocus = document.activeElement;
    const popup = document.createElement("div");
    popup.className = "node-picker";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = options.placeholder;
    input.autocomplete = "off";
    input.setAttribute("aria-label", options.placeholder);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "pickerResults");
    const list = document.createElement("div");
    list.className = "picker-results";
    list.id = "pickerResults";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", options.placeholder);
    popup.append(input, list);
    document.body.append(popup);

    let visible: PickerItem[] = [];
    let selected = 0;
    let rows: HTMLElement[] = [];
    const indexedItems = (options.items || []).map(item => ({
        item, text: [item.label, item.detail, item.group].join(" ").toLowerCase()
    }));

    function close() {
        document.removeEventListener("pointerdown", outside, true);
        window.removeEventListener("resize", position);
        popup.remove();
        closePicker = undefined;
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
    }

    function outside(event: PointerEvent) {
        if (!popup.contains(event.target as Node)) close();
    }

    function position() {
        popup.style.left = Math.max(0, Math.min(options.x, window.innerWidth - popup.offsetWidth)) + "px";
        popup.style.top = Math.max(0, Math.min(options.y, window.innerHeight - popup.offsetHeight)) + "px";
    }

    function highlight(index: number) {
        selected = index;
        rows.forEach((row, i) => {
            row.classList.toggle("selected", i === selected);
            row.setAttribute("aria-selected", String(i === selected));
        });
        if (rows[selected]) {
            input.setAttribute("aria-activedescendant", rows[selected].id);
            rows[selected].scrollIntoView({block: "nearest"});
        } else input.removeAttribute("aria-activedescendant");
    }

    function pick(index: number) {
        const item = visible[index];
        if (!item) return;
        close();
        options.onPick(item.value);
    }

    function render() {
        const query = input.value.trim();
        const words = query.toLowerCase().split(/\s+/);
        const matches = options.search ? options.search(query) : indexedItems
            .filter(entry => words.every(word => entry.text.includes(word))).map(entry => entry.item);
        visible = matches.slice(0, 50);
        rows = [];
        list.replaceChildren();
        let group: string | undefined;
        visible.forEach((item, index) => {
            if (!query && item.group && item.group !== group) {
                group = item.group;
                const header = document.createElement("div");
                header.className = "picker-group";
                header.setAttribute("role", "presentation");
                header.textContent = group;
                list.append(header);
            }
            const row = document.createElement("div");
            row.className = "picker-row";
            row.id = "pickerOption" + index;
            row.setAttribute("role", "option");
            for (const [className, text] of [["picker-label", item.label], ["picker-detail", item.detail], ["picker-note", item.note]] as const) {
                if (!text) continue;
                const part = document.createElement("div");
                part.className = className;
                part.textContent = text;
                row.append(part);
            }
            row.addEventListener("pointerdown", event => event.preventDefault());
            row.addEventListener("mouseenter", () => highlight(index));
            row.addEventListener("click", () => pick(index));
            rows.push(row);
            list.append(row);
        });
        if (!matches.length || matches.length > 50) {
            const status = document.createElement("div");
            status.className = "picker-status";
            status.setAttribute("role", "status");
            status.textContent = matches.length ? `${matches.length - 50} more, keep typing to narrow` : "No matches. Try another search.";
            list.append(status);
        }
        highlight(0);
        position();
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", event => {
        event.stopPropagation();
        if (event.key === "Escape") close();
        else if (event.key === "Enter") pick(selected);
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (visible.length) highlight((selected + (event.key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length);
        } else return;
        event.preventDefault();
    });
    popup.addEventListener("wheel", event => event.stopPropagation());
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", position);
    closePicker = close;
    render();
    input.focus();
}
