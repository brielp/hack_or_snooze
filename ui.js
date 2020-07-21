$(async function() {
	// cache some selectors we'll be using quite a bit
	const $allStoriesList = $('#all-articles-list');
	const $submitForm = $('#submit-form');
	const $filteredArticles = $('#filtered-articles');
	const $loginForm = $('#login-form');
	const $createAccountForm = $('#create-account-form');
	const $ownStories = $('#my-articles');
	const $navLogin = $('#nav-login');
	const $navLogOut = $('#nav-logout');
	const $newStory = $('#nav-new-story');
	const $navWelcome = $('#nav-welcome');
	const $navFavorites = $('#nav-favorite-stories');
	const $favoritedArticles = $('#favorited-articles');

	// global storyList variable
	let storyList = null;

	// global currentUser variable
	let currentUser = null;

	await checkIfLoggedIn();

	/**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

	$loginForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the username and password
		const username = $('#login-username').val();
		const password = $('#login-password').val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	/**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

	$createAccountForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page refresh

		// grab the required fields
		let name = $('#create-account-name').val();
		let username = $('#create-account-username').val();
		let password = $('#create-account-password').val();

		// call the create method, which calls the API and then builds a new user instance
		const newUser = await User.create(username, password, name);
		currentUser = newUser;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	$submitForm.on('submit', async function(e) {
		e.preventDefault();
		const author = $('#author').val();
		const title = $('#title').val();
		const url = $('#url').val();

		const newStory = await storyList.addStory(currentUser, { author, title, url });
		const result = generateStoryHTML(newStory.data.story);
		$allStoriesList.prepend(result);
		$submitForm.trigger('reset');
		$submitForm.slideToggle();
	});

	/**
   * Log Out Functionality
   */

	$navLogOut.on('click', function() {
		// empty out local storage
		localStorage.clear();
		// refresh the page, clearing memory
		location.reload();
	});

	/**
   * Event Handler for Clicking New Story button
   */

	$newStory.on('click', function() {
		$submitForm.slideToggle();
	});

	$navFavorites.on('click', function() {
		$allStoriesList.hide();
		$favoritedArticles.show();
	});

	/**
   * Event Handler for Clicking Login
   */

	$navLogin.on('click', function() {
		// Show the Login and Create Account Forms
		$loginForm.slideToggle();
		$createAccountForm.slideToggle();
		$allStoriesList.toggle();
	});

	/**
   * Event handler for Navigation to Homepage
   */

	$('body').on('click', '#nav-all', async function() {
		hideElements();
		await generateStories();
		$allStoriesList.show();
	});

	/**
   * Event handler for favoriting a story
   */

	$('body').on('click', '.fa-star', async function(e) {
		if (!currentUser) return;

		const storyId = e.target.parentElement.id;
		const isFavorited = currentUser.favorites.some((fav) => {
			return fav.storyId === storyId;
		});

		if (isFavorited) {
			const unfavorited = await currentUser.unfavoriteStory(storyId);
			$(this).attr('class', 'far fa-star');
			currentUser.favorites = unfavorited.data.user.favorites;
		} else {
			const favorited = await currentUser.favoriteStory(storyId);
			$(this).attr('class', 'fas fa-star');
			currentUser.favorites = favorited.data.user.favorites;
		}
		generateFavorites();
	});

	$('body').on('click', '.fa-trash', function(e) {
		const storyId = e.target.parentElement.id;
		storyList.deleteStory(currentUser, storyId);
		$(`#${storyId}`).remove();
	});

	/**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

	async function checkIfLoggedIn() {
		// let's see if we're logged in
		const token = localStorage.getItem('token');
		const username = localStorage.getItem('username');

		// if there is a token in localStorage, call User.getLoggedInUser
		//  to get an instance of User with the right details
		//  this is designed to run once, on page load
		currentUser = await User.getLoggedInUser(token, username);
		await generateStories();

		if (currentUser) {
			showNavForLoggedInUser();
		}
	}

	/**
   * A rendering function to run to reset the forms and hide the login info
   */

	async function loginAndSubmitForm() {
		// hide the forms for logging in and signing up
		$loginForm.hide();
		$createAccountForm.hide();

		// reset those forms
		$loginForm.trigger('reset');
		$createAccountForm.trigger('reset');

		// show the stories
		await generateStories();
		$allStoriesList.show();

		// update the navigation bar
		showNavForLoggedInUser();
	}

	/**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

	async function generateStories() {
		// get an instance of StoryList
		const storyListInstance = await StoryList.getStories();
		// update our global variable
		storyList = storyListInstance;
		// empty out that part of the page
		$allStoriesList.empty();

		// loop through all of our stories and generate HTML for them
		for (let story of storyList.stories) {
			const result = generateStoryHTML(story);
			$allStoriesList.append(result);
		}

		generateFavorites();
	}

	function generateFavorites() {
		if (!currentUser) return;
		$favoritedArticles.empty();

		for (let story of currentUser.favorites) {
			const result = generateStoryHTML(story);
			$favoritedArticles.append(result);
		}
	}

	/**
   * A function to render HTML for an individual Story instance
   */

	function generateStoryHTML(story) {
		let hostName = getHostName(story.url);
		let iconClass = starFavorite(story);
		let trashClass = isOwner(story);

		// render story markup
		const storyMarkup = $(`
	  <li id="${story.storyId}">
	  	<i class="${iconClass}" id="icon-${story.storyId}"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
		<small class="article-hostname ${hostName}">(${hostName})</small>
		<i class="${trashClass}"></i>
		<small class="article-username">posted by ${story.username}</small>
      </li>
	`);

		return storyMarkup;
	}

	/* hide all elements in elementsArr */

	function hideElements() {
		const elementsArr = [
			$submitForm,
			$allStoriesList,
			$filteredArticles,
			$ownStories,
			$loginForm,
			$createAccountForm,
			$favoritedArticles
		];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	function showNavForLoggedInUser() {
		$navLogin.hide();
		$navLogOut.show();
		$newStory.show();
		$navFavorites.show();
		$navWelcome.text(`Welcome, ${currentUser.name}!`).show();
		$('#profile-name').text(`Name: ${currentUser.name}`);
		$('#profile-username').text(`Username: ${currentUser.username}`);
		const date = new Date(currentUser.createdAt);
		$('#profile-account-date').text(`Account Created: ${date}`);
	}

	/* simple functio
	n to pull the hostname from a URL */

	function getHostName(url) {
		let hostName;
		if (url.indexOf('://') > -1) {
			hostName = url.split('/')[2];
		} else {
			hostName = url.split('/')[0];
		}
		if (hostName.slice(0, 4) === 'www.') {
			hostName = hostName.slice(4);
		}
		return hostName;
	}

	function starFavorite(story) {
		if (currentUser) {
			for (let fav of currentUser.favorites) {
				if (fav.storyId === story.storyId) {
					return 'fas fa-star';
				}
			}
		}
		return 'far fa-star';
	}

	function isOwner(story) {
		if (currentUser) {
			if (story.username === currentUser.username) {
				return 'fas fa-trash';
			}
		}
		return 'hidden';
	}

	/* sync current user information to localStorage */

	function syncCurrentUserToLocalStorage() {
		if (currentUser) {
			localStorage.setItem('token', currentUser.loginToken);
			localStorage.setItem('username', currentUser.username);
		}
	}
});
