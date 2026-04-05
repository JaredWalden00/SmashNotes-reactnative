import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function SelectMenuButton({
  value,
  options,
  onSelect,
  placeholder = "Select",
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
  maxListHeight = 220,
  onToggleOpen,
  anchorStyle,
  buttonStyle,
  labelStyle,
  caretStyle,
  dropdownStyle,
  listStyle,
  itemStyle,
  itemActiveStyle,
  itemLabelStyle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const safeOptions = options || [];

  const selectedOption = useMemo(
    () => safeOptions.find((option) => option.value === value),
    [safeOptions, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return safeOptions;
    const query = search.trim().toLowerCase();
    return safeOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search, searchable]);

  function toggleOpen() {
    if (disabled) {
      return;
    }

    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    onToggleOpen?.(nextOpen);
    if (!nextOpen) {
      setSearch("");
    } else if (searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }

  function handleSelect(nextValue) {
    setIsOpen(false);
    setSearch("");
    onToggleOpen?.(false);
    onSelect(nextValue);
  }

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    function handleOutsidePress(event) {
      const container = containerRef.current;
      if (container && container.contains && !container.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
        onToggleOpen?.(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePress, true);
    document.addEventListener("touchstart", handleOutsidePress, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePress, true);
      document.removeEventListener("touchstart", handleOutsidePress, true);
    };
  }, [isOpen, onToggleOpen]);

  const dropdownListStyle = [styles.list, { maxHeight: maxListHeight }, listStyle];

  return (
    <View ref={containerRef} style={[styles.anchor, anchorStyle]}>
      <Pressable style={[styles.button, buttonStyle, disabled && styles.buttonDisabled]} onPress={toggleOpen} disabled={disabled}>
        {selectedOption?.icon ? (
          <Image source={selectedOption.icon} style={styles.buttonIcon} />
        ) : null}
        <Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={[styles.caret, caretStyle]}>{isOpen ? "^" : "v"}</Text>
      </Pressable>

      {isOpen ? (
        <View style={[styles.dropdown, dropdownStyle]}>
          {searchable ? (
            <View style={styles.searchWrap}>
              <TextInput
                ref={searchRef}
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor="#5A6B84"
                autoFocus
              />
            </View>
          ) : null}
          <ScrollView style={dropdownListStyle} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <Pressable
                  key={String(option.value)}
                  style={[
                    styles.item,
                    itemStyle,
                    option.value === value && styles.itemActive,
                    option.value === value && itemActiveStyle,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  {option.icon ? (
                    <Image source={option.icon} style={styles.itemIcon} />
                  ) : null}
                  <Text style={[styles.itemLabel, itemLabelStyle]}>{option.label}</Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyLabel}>No results</Text>
              </View>
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "relative",
    zIndex: 1,
  },
  button: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C3855",
    backgroundColor: "#111A2D",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  label: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
    flex: 1,
  },
  caret: {
    color: "#9FB0CF",
    fontSize: 11,
    fontWeight: "900",
  },
  dropdown: {
    position: "absolute",
    top: 44,
    right: 0,
    minWidth: 220,
    maxWidth: 260,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2D3957",
    backgroundColor: "#10192C",
    zIndex: 9999,
    elevation: 9999,
    paddingVertical: 6,
  },
  searchWrap: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#2D3957",
    marginBottom: 4,
  },
  searchInput: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    paddingHorizontal: 10,
    color: "#ECF2FF",
    fontSize: 13,
    fontWeight: "600",
    outlineStyle: "none",
  },
  list: {
    maxHeight: 220,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemActive: {
    backgroundColor: "#1A2540",
  },
  itemIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  itemLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyWrap: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  emptyLabel: {
    color: "#5A6B84",
    fontSize: 12,
    fontWeight: "600",
  },
});
