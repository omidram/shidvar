const ENAMAD_HREF = "https://trustseal.enamad.ir/?id=8860636&Code=bu6mACV10wXJdIWOMFvoVuxcDWgNAo47";
const ENAMAD_SRC = "https://trustseal.enamad.ir/logo.aspx?id=8860636&Code=bu6mACV10wXJdIWOMFvoVuxcDWgNAo47";
const ENAMAD_CODE = "bu6mACV10wXJdIWOMFvoVuxcDWgNAo47";

export function EnamadSeal() {
  return (
    <a referrerPolicy="origin" target="_blank" href={ENAMAD_HREF} aria-label="نماد اعتماد الکترونیکی">
      <img
        {...({
          referrerPolicy: "origin",
          src: ENAMAD_SRC,
          alt: "",
          code: ENAMAD_CODE,
          style: { cursor: "pointer" },
          width: 125,
          height: 140,
          className: "h-[140px] w-[125px] object-contain",
        } as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    </a>
  );
}
