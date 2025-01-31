let editingRow = null;
let currentSortColumn = -1;
let currentSortDirection = "asc";

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("https://biscicol.org/dff/v1/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok && data.token) {  
            localStorage.setItem("token", data.token);
            loadData();
        } else {
            alert("Login failed! ❌ " + (data.error || "Unknown error"));
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Network error! ❌ Unable to reach server.");
    }
}

async function loadData() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please log in first.");
        return;
    }

    try {
        const response = await fetch("https://biscicol.org/dff/v1/data", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await response.json();
        populateCategoryFilter(data); // ✅ Populate dropdown dynamically
        populateTable(data);
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Session expired. Please log in again.");
    }
}

// ✅ Populate Category Dropdown
function populateCategoryFilter(data) {
    let categoryFilter = document.getElementById("categoryFilter");
    let categories = [...new Set(data.map(item => item.category))]; // ✅ Get unique categories

    categoryFilter.innerHTML = `<option value="">All Categories</option>`; // Reset options
    categories.forEach(category => {
        categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

// ✅ Filter Table by Search & Category
function filterTable() {
    let searchInput = document.getElementById("searchInput").value.toLowerCase();
    let categoryFilter = document.getElementById("categoryFilter").value;
    let rows = document.querySelectorAll("#tableBody tr");

    rows.forEach(row => {
        let text = row.textContent.toLowerCase();
        let category = row.cells[0].textContent; // ✅ Get category from first column

        let matchesSearch = text.includes(searchInput);
        let matchesCategory = categoryFilter === "" || category === categoryFilter;

        row.style.display = matchesSearch && matchesCategory ? "" : "none";
    });
}


function populateTable(data) {
    let tableBody = document.getElementById("tableBody");
    tableBody.innerHTML = "";

    data.forEach(row => {
        tableBody.innerHTML += `
            <tr data-id="${row.id}">
                <td>${row.category}</td>
                <td>${row.productName}</td>
                <td>${row.packageName}</td>
                <td>${row.available_on_ll ? 'True' : 'False'}</td>
                <td><div class="toggle-switch ${row.visible ? 'active' : ''}" onclick="toggleEdit(this)"></div></td>
                <td><div class="toggle-switch ${row.track_inventory ? 'active' : ''}" onclick="toggleEdit(this)"></div></td>
                <td><input type="number" class="stock-input" value="${row.stock_inventory}" disabled></td>
                <td>
                    <button onclick="editRow(this)">Edit</button>
                    <button onclick="saveRow(this)" style="display:none;">Save</button>
                    <button onclick="cancelRow()" style="display:none;">Cancel</button>
                </td>
            </tr>`;
    });
}

// ✅ Sorting Function
function sortTable(columnIndex) {
    let table = document.getElementById("tableBody");
    let rows = Array.from(table.rows);

    // Toggle sorting direction
    if (currentSortColumn === columnIndex) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
        currentSortDirection = "asc";
    }
    currentSortColumn = columnIndex;

    rows.sort((rowA, rowB) => {
        let cellA = rowA.cells[columnIndex].textContent.trim();
        let cellB = rowB.cells[columnIndex].textContent.trim();

        if (!isNaN(cellA) && !isNaN(cellB)) {
            return currentSortDirection === "asc" ? cellA - cellB : cellB - cellA;
        } else {
            return currentSortDirection === "asc"
                ? cellA.localeCompare(cellB)
                : cellB.localeCompare(cellA);
        }
    });

    table.innerHTML = "";
    rows.forEach(row => table.appendChild(row));
}

function logout() {
    localStorage.removeItem("token");
    document.getElementById("tableBody").innerHTML = "";
    alert("Logged out!");
}

window.onload = function() {
    if (localStorage.getItem("token")) {
        loadData();
    }
};
