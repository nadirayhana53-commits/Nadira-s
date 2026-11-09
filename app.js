
// =====================================
// KONFIGURASI SUPABASE
// =====================================

const SUPABASE_URL = "https://bvzvgqmrllkdxxxgfkuc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DoL5M1aD1WF6TKOkJtfqlg_5wdPUA-a";

const BUCKET = "task-files";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// =====================================
// ELEMENT WEBSITE
// =====================================

const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileTugas");
const fileName = document.getElementById("fileName");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterMatkul = document.getElementById("filterMatkul");
const uploadMessage = document.getElementById("uploadMessage");

let allTasks = [];


// =====================================
// FORMAT TANGGAL
// =====================================

function formatDate(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}


// =====================================
// NOTIFIKASI
// =====================================

function showMessage(message, success = true) {
  uploadMessage.textContent = message;
  uploadMessage.style.color = success ? "#23845b" : "#d64268";
}


// =====================================
// CEK FILE YANG DIPILIH
// =====================================

fileInput.addEventListener("change", function () {
  const file = fileInput.files[0];

  fileName.textContent = file
    ? file.name
    : "Belum ada file dipilih";
});


// =====================================
// AMBIL DATA TUGAS
// =====================================

async function loadTasks() {
  taskList.innerHTML = `
    <tr>
      <td colspan="4" class="empty-state">
        Memuat daftar tugas...
      </td>
    </tr>
  `;

  const { data, error } = await db
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil data:", error);

    taskList.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          Gagal memuat tugas. Periksa konfigurasi Supabase dan SQL.
        </td>
      </tr>
    `;

    return;
  }

  allTasks = data || [];

  renderTasks(allTasks);
  updateStatistics(allTasks);
}


// =====================================
// TAMPILKAN DAFTAR TUGAS
// =====================================

function renderTasks(tasks) {
  if (!tasks.length) {
    taskList.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <div>📂</div>
          <strong>Belum ada tugas</strong>
          <p>Dokumen yang diunggah akan muncul di sini.</p>
        </td>
      </tr>
    `;
    return;
  }

  taskList.innerHTML = tasks.map(task => `
    <tr>
      <td>
        <strong>${escapeHTML(task.title)}</strong>
        ${task.description
          ? `<small class="task-description">${escapeHTML(task.description)}</small>`
          : ""}
      </td>

      <td>${escapeHTML(task.course)}</td>

      <td>${formatDate(task.created_at)}</td>

      <td>
        <button
          class="download-button"
          type="button"
          data-path="${encodeURIComponent(task.file_path)}"
        >
          ↓ Download
        </button>
      </td>
    </tr>
  `).join("");
}


// =====================================
// AMANKAN TEKS YANG DITAMPILKAN
// =====================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}


// =====================================
// DOWNLOAD FILE
// =====================================

taskList.addEventListener("click", async function (event) {
  const button = event.target.closest(".download-button");

  if (!button) return;

  const path = decodeURIComponent(button.dataset.path);

  const { data } = db.storage
    .from(BUCKET)
    .getPublicUrl(path);

  if (data?.publicUrl) {
    window.open(data.publicUrl, "_blank", "noopener,noreferrer");
  } else {
    alert("Link download tidak dapat dibuat.");
  }
});


// =====================================
// UPLOAD TUGAS
// =====================================

uploadForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const title = document.getElementById("namaTugas").value.trim();
  const course = document.getElementById("mataKuliah").value;
  const description = document.getElementById("deskripsi").value.trim();
  const file = fileInput.files[0];

  if (!title || !course || !file) {
    showMessage("Lengkapi semua data dan pilih dokumen.", false);
    return;
  }

  const allowedExtensions = [
    "pdf", "doc", "docx", "ppt", "pptx"
  ];

  const extension = file.name.split(".").pop().toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    showMessage("Format file tidak didukung.", false);
    return;
  }

  const maxSize = 10 * 1024 * 1024;

  if (file.size > maxSize) {
    showMessage("Ukuran file maksimal 10 MB.", false);
    return;
  }

  const submitButton = uploadForm.querySelector(
    'button[type="submit"]'
  );

  submitButton.disabled = true;
  submitButton.textContent = "Mengunggah...";

  try {
    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath =
      `${Date.now()}_${crypto.randomUUID()}_${safeFileName}`;

    // Upload file ke Supabase Storage
    const { error: storageError } = await db.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (storageError) {
      throw storageError;
    }

    // Simpan informasi tugas ke database
    const { error: databaseError } = await db
      .from("tasks")
      .insert({
        title: title,
        course: course,
        description: description,
        file_name: file.name,
        file_path: filePath
      });

    if (databaseError) {
      // Coba bersihkan file jika penyimpanan data gagal
      await db.storage.from(BUCKET).remove([filePath]);
      throw databaseError;
    }

    showMessage("Tugas berhasil diunggah!");

    uploadForm.reset();
    fileName.textContent = "Belum ada file dipilih";

    await loadTasks();

    document.getElementById("tugas").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    console.error("Upload gagal:", error);
    showMessage(
      "Upload gagal: " + (error.message || "Terjadi kesalahan."),
      false
    );

  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = "♡ Upload Tugas";
  }
});


// =====================================
// PENCARIAN DAN FILTER
// =====================================

function filterTasks() {
  const keyword = searchInput.value.toLowerCase().trim();
  const selectedCourse = filterMatkul.value;

  const filtered = allTasks.filter(task => {
    const matchKeyword =
      task.title.toLowerCase().includes(keyword) ||
      task.course.toLowerCase().includes(keyword);

    const matchCourse =
      !selectedCourse || task.course === selectedCourse;

    return matchKeyword && matchCourse;
  });

  renderTasks(filtered);
}

searchInput.addEventListener("input", filterTasks);
filterMatkul.addEventListener("change", filterTasks);


// =====================================
// STATISTIK
// =====================================

function updateStatistics(tasks) {
  document.getElementById("totalMatkul").textContent = "8";
  document.getElementById("totalTugas").textContent = tasks.length;
  document.getElementById("totalFile").textContent = tasks.length;
}


// =====================================
// NAVIGASI AKTIF
// =====================================

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", function () {
    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    this.classList.add("active");
  });
});


// =====================================
// JALANKAN WEBSITE
// =====================================

loadTasks();
