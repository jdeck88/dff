let editingRow = null;

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
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Session expired. Please log in again.");
    }
}

function toggleEdit(element) {
    if (editingRow !== null) {
        element.classList.toggle("active");
    }
}

function editRow(button) {
    if (editingRow !== null) return;
    let row = button.closest("tr");
    editingRow = row.getAttribute("data-id");

    row.querySelectorAll(".toggle-switch, .stock-input").forEach(el => {
        el.style.pointerEvents = "auto";
        if (el.tagName === "INPUT") {
            el.removeAttribute("disabled");
        }
    });

    button.style.display = "none";
    row.querySelector("button[onclick^='saveRow']").style.display = "inline";
    row.querySelector("button[onclick^='cancelRow']").style.display = "inline";
}

async function saveRow(button) {
    let row = button.closest("tr");
    let id = row.getAttribute("data-id");

    if (!id) {
        console.error("❌ Error: Row ID is missing!", row);
        alert("Error saving data. Missing row ID.");
        return;
    }

    let data = {
        visible: row.querySelectorAll(".toggle-switch")[0].classList.contains("active"),
        track_inventory: row.querySelectorAll(".toggle-switch")[1].classList.contains("active"),
        stock_inventory: row.querySelector(".stock-input").value
    };

    try {
        let response = await fetch(`https://biscicol.org/dff/v1/update/${id}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error("Failed to update data.");
        }

        cancelRow();
    } catch (error) {
        console.error("❌ Error updating data:", error);
        alert("Failed to save changes. Please try again.");
    }
}

function cancelRow() {
    editingRow = null;
    loadData();
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
