export default function Landscape({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "landscape small" : "landscape"}
      viewBox="0 0 560 260"
      aria-hidden="true"
      fill="none"
    >
      <path fill="#D9EDF0" d="M0 0h560v260H0z" />
      <circle cx="429" cy="53" r="28" fill="#F8DB9C" />
      <g fill="#F9FCF6">
        <path d="M47 57c0-9 13-17 24-11 7-19 36-15 39 2 17-3 24 4 24 12H47Z" />
        <path d="M324 28c3-9 14-12 22-7 11-19 37-11 37 5 15-3 24 5 23 10h-82Z" />
        <path d="M478 85c3-9 13-13 22-7 9-16 29-12 32 3 16-3 22 4 22 11h-76Z" />
      </g>
      <path
        d="m-20 206 138-110 128 110 97-139 159 140 82-64v117H-20Z"
        fill="#B4D1C7"
      />
      <path
        d="m180 210 130-92 159 92 91-43v93H0v-42l102-55 78 47Z"
        fill="#8AB4A2"
      />
      <path
        d="M0 239c97-29 126-5 209-10 112-9 184-29 351-4v35H0Z"
        fill="#6D9B83"
      />
      <path d="M0 254c120-17 149-11 228 6H0Z" fill="#A8D2B4" />
      <path d="M259 259c12-23 49-21 55-42" stroke="#F9E3B3" strokeWidth="13" />
      <g stroke="#526F62" strokeWidth="3" strokeLinejoin="round">
        <path d="M350 206h91v-40h-91z" fill="#FAF6E8" />
        <path d="M365 170h61v-32h-61z" fill="#FAF6E8" />
        <path d="M377 140h37v-23h-37z" fill="#FAF6E8" />
        <path
          d="m337 167 58-26 59 26c-12 3-19 2-27-1h-65c-9 3-15 4-25 1Z"
          fill="#456E62"
        />
        <path
          d="m355 137 40-24 41 24c-9 3-13 2-20 0h-40c-8 2-14 3-21 0Z"
          fill="#456E62"
        />
        <path
          d="m366 115 29-19 29 19c-12 3-17 0-29-1-11 1-18 4-29 1Z"
          fill="#456E62"
        />
        <path d="M385 205v-22h20v22" fill="#E2C395" />
        <path d="M373 178h8m27 0h8m-29-31h16" />
      </g>
      <g fill="#E1A97C">
        <path d="m72 236 18-34 18 34Z" />
        <path d="m75 215 15-28 15 28Z" />
      </g>
      <path d="M90 226v18" stroke="#6B7968" strokeWidth="3" />
      <g fill="#D6DEBB">
        <path d="m470 226 19-37 19 37Z" />
        <path d="m476 203 13-28 13 28Z" />
      </g>
      <path d="M489 215v20" stroke="#526F62" strokeWidth="3" />
      <path
        d="m161 66 6-4 6 4m18 13 5-3 5 3"
        stroke="#77958C"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g stroke="#456E62" strokeWidth="2" strokeLinecap="round">
        <path d="m192 221 18-18 18 18m-29-6v17h22v-17" fill="#F6DEC0" />
        <path d="m203 232 6-12 7 12" fill="#6F9C84" />
      </g>
    </svg>
  );
}
