          <div class="row journal-row">
         <% entries.forEach((element, i) => { %>
            <div class="col-lg-4 col-md-6">
                  <h1>Journal <%= i += 1 %></h1> 
                  <h4>How do you feel today?</h4><%= element.mood %>
                  <h4>What did you accomplish today?</h4> <%= element.accomplishment %> 
                  <h4>Meal:</h4> <%= element.meal %>
                  <h4>Workout: <%= element.workout %></h4>
                  <h4>Did any notable events happen today? <%= element.event %></h4>
                  <h4>How much did you spend today?</h4> <%= element.spending %>
                </div>
                  <% }); %> 
        </div>