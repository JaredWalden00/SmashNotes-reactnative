import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function SelectMenuButton({
  value,
  options,
  onSelect,
  placeholder = "Select",
  disabled = false,
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
  const containerRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  function toggleOpen() {
    if (disabled) {
      return;
    }

    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    onToggleOpen?.(nextOpen);
  }

  function handleSelect(nextValue) {
    setIsOpen(false);
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
        <Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={[styles.caret, caretStyle]}>{isOpen ? "^" : "v"}</Text>
      </Pressable>

      {isOpen ? (
        <View style={[styles.dropdown, dropdownStyle]}>
          <ScrollView style={dropdownListStyle} nestedScrollEnabled>
            {options.map((option) => (
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
                <Text style={[styles.itemLabel, itemLabelStyle]}>{option.label}</Text>
              </Pressable>
            ))}
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
  list: {
    maxHeight: 220,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemActive: {
    backgroundColor: "#1A2540",
  },
  itemLabel: {
    color: "#ECF2FF",
    fontWeight: "700",
    fontSize: 12,
  },
});
