interface Department {
  prefix: string;
  name: string;
  facultyUrl: string;
}

export const departments = [
  {
    facultyUrl: "https://kinesiology.acadiau.ca/faculty-staff.html",
    name: "Kinesiology",
    prefix: "KINE",
  },
  {
    facultyUrl: "https://education.acadiau.ca/faculty-staff.html",
    name: "Education",
    prefix: "EDUC",
  },
  {
    facultyUrl: "https://biology.acadiau.ca/faculty-staff.html",
    name: "Biology",
    prefix: "BIOL",
  },
  {
    facultyUrl: "https://math.acadiau.ca/faculty.html",
    name: "Mathematics and Statistics",
    prefix: "MATH",
  },
  {
    facultyUrl: "https://history.acadiau.ca/Faculty/Staff.html",
    name: "History",
    prefix: "HIST",
  },
  {
    facultyUrl: "https://english.acadiau.ca/faculty-staff.html",
    name: "English",
    prefix: "ENGL",
  },
  {
    facultyUrl: "https://polisci.acadiau.ca/faculty-and-staff.html",
    name: "Political Science",
    prefix: "POLS",
  },
  {
    facultyUrl: "https://music.acadiau.ca/faculty.html",
    name: "Music",
    prefix: "MUSI",
  },
  {
    facultyUrl: "https://business.acadiau.ca/about-us/faculty-directory.html",
    name: "Business Administration",
    prefix: "BUSI",
  },
  {
    facultyUrl: "https://chemistry.acadiau.ca/faculty-staff.html",
    name: "Chemistry",
    prefix: "CHEM",
  },
  {
    facultyUrl: "https://sociology.acadiau.ca/People.html",
    name: "Sociology",
    prefix: "SOCI",
  },
  {
    facultyUrl: "https://cs.acadiau.ca/faculty-staff.html",
    name: "Computer Science",
    prefix: "COMP",
  },
  {
    facultyUrl: "https://ees.acadiau.ca/faculty-staff.html",
    name: "Geology",
    prefix: "GEOL",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Biblical Studies",
    prefix: "BIBL",
  },
  {
    facultyUrl: "https://psychology.acadiau.ca/Faculty_and_Staff.html",
    name: "Psychology",
    prefix: "PSYC",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Pastoral Care and Counselling",
    prefix: "PACC",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Next Generation Ministry",
    prefix: "NXGN",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Evangelism and Mission",
    prefix: "EVAN",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Pastoral Ministry",
    prefix: "PAST",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Theology",
    prefix: "THEO",
  },
  {
    facultyUrl: "https://economics.acadiau.ca/our-people.html",
    name: "Economics",
    prefix: "ECON",
  },
  {
    facultyUrl: "https://languages.acadiau.ca/faculty-and-staff.html",
    name: "French",
    prefix: "FRAN",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Leadership",
    prefix: "LEDR",
  },
  {
    facultyUrl: "https://nutrition.acadiau.ca/faculty-and-staff.html",
    name: "Nutrition",
    prefix: "NUTR",
  },
  {
    facultyUrl: "https://commdev.acadiau.ca/faculty-staff.html",
    name: "Community Development",
    prefix: "CODE",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Church History",
    prefix: "CHUR",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Discipleship",
    prefix: "DISP",
  },
  {
    facultyUrl: "https://engineering.acadiau.ca/faculty-and-staff.html",
    name: "Applied Science",
    prefix: "APSC",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Ministry",
    prefix: "DMIN",
  },
  {
    facultyUrl: "https://physics.acadiau.ca/people.html",
    name: "Physics",
    prefix: "PHYS",
  },
  {
    facultyUrl: "https://philosophy.acadiau.ca/facstaff.html",
    name: "Philosophy",
    prefix: "PHIL",
  },
  {
    facultyUrl:
      "https://arts.acadiau.ca/international-development-studies.html",
    name: "Interdisciplinary Studies",
    prefix: "IDST",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Spiritual Formation",
    prefix: "SPFM",
  },
  {
    facultyUrl: "https://history.acadiau.ca/Faculty/Staff.html",
    name: "Classics",
    prefix: "CLAS",
  },
  {
    facultyUrl: "https://theatre.acadiau.ca/faculty-staff.html",
    name: "Theatre",
    prefix: "THEA",
  },
  {
    facultyUrl: "https://history.acadiau.ca/Faculty/Staff.html",
    name: "Greek",
    prefix: "GREE",
  },
  {
    facultyUrl: "https://nursing.acadiau.ca/faculty-staff.html",
    name: "Nursing",
    prefix: "NURS",
  },
  {
    facultyUrl: "https://arts.acadiau.ca/art-courses/faculty.html",
    name: "Art",
    prefix: "ART",
  },
  {
    facultyUrl: "https://languages.acadiau.ca/faculty-and-staff.html",
    name: "German",
    prefix: "GERM",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Chaplaincy",
    prefix: "CHAP",
  },
  {
    facultyUrl: "https://ees.acadiau.ca/faculty-staff.html",
    name: "Environmental Science",
    prefix: "ENVS",
  },
  {
    facultyUrl: "https://commdev.acadiau.ca/faculty-staff.html",
    name: "Indigenous Community Develop.",
    prefix: "INCD",
  },
  {
    facultyUrl: "https://womenstudies.acadiau.ca/Faculty_Members.html",
    name: "Women's and Gender Studies",
    prefix: "WGST",
  },
  {
    facultyUrl: "https://environment.acadiau.ca/faculty_staff.html",
    name: "Environ. and Sustain. Studies",
    prefix: "ESST",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Hebrew",
    prefix: "HEBR",
  },
  {
    facultyUrl: "https://languages.acadiau.ca/faculty-and-staff.html",
    name: "Spanish",
    prefix: "SPAN",
  },
  {
    facultyUrl: "https://history.acadiau.ca/Faculty/Staff.html",
    name: "Comparative Religion",
    prefix: "CREL",
  },
  {
    facultyUrl: "https://history.acadiau.ca/Faculty/Staff.html",
    name: "Latin",
    prefix: "LATI",
  },
  {
    facultyUrl: "https://co-op.acadiau.ca/Contact.html",
    name: "Cooperative Education",
    prefix: "COOP",
  },
  {
    facultyUrl: "https://biology.acadiau.ca/faculty-staff.html",
    name: "Biotechnology",
    prefix: "BIOT",
  },
  {
    facultyUrl: "https://business.acadiau.ca/about-us/faculty-directory.html",
    name: "Communications",
    prefix: "COMM",
  },
  {
    facultyUrl: "https://laws.acadiau.ca/faculty.html",
    name: "Law and Society",
    prefix: "LAWS",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Aramaic",
    prefix: "ARAM",
  },
  {
    facultyUrl: "https://ees.acadiau.ca/faculty-staff.html",
    name: "Applied Geomatics",
    prefix: "GEOM",
  },
  {
    facultyUrl: "https://spt.acadiau.ca/spt-faculty.html",
    name: "Social and Political Thought",
    prefix: "SOPT",
  },
  {
    facultyUrl: "https://acadiadiv.ca/faculty/",
    name: "Interdisciplinary Studies Theo",
    prefix: "IDTH",
  },
  {
    facultyUrl: "https://languages.acadiau.ca/faculty-and-staff.html",
    name: "Languages and Literatures",
    prefix: "LANG",
  },
  {
    facultyUrl: "https://education.acadiau.ca/faculty-staff.html",
    name: "Mi'kmaw",
    prefix: "MIKM",
  },
] as const satisfies readonly Department[];
